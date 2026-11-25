import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Unsubscribe,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from './firebase';

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ],
  iceCandidatePoolSize: 4,
};

interface SignalDoc {
  roomCode: string;
  fromUid: string;
  toUid: string;
  type: 'offer' | 'answer' | 'ice';
  payload: string;
}

interface PeerRecord {
  remoteUid: string;
  pc: RTCPeerConnection;
  audioSender: RTCRtpSender | null;
  pendingCandidates: RTCIceCandidateInit[];
  audioEl: HTMLAudioElement;
  polite: boolean;
  makingOffer: boolean;
  ignoreOffer: boolean;
  isSettingRemoteAnswerPending: boolean;
}

export class RoomVoiceClient {
  private roomCode: string;
  private localUid: string;
  private peers = new Map<string, PeerRecord>();
  private localStream: MediaStream | null = null;
  private micEnabled = false;
  private speakerMuted = false;
  private disposed = false;
  private unsubSignals: Unsubscribe | null = null;
  private unsubPeers: Unsubscribe | null = null;
  private processedSignals = new Set<string>();
  private onMicMapChange: (map: Record<string, boolean>) => void;
  private onError: (msg: string) => void;
  private unlockHandler: (() => void) | null = null;

  constructor(params: {
    roomCode: string;
    localUid: string;
    peerUids: string[];
    onMicMapChange: (map: Record<string, boolean>) => void;
    onError: (msg: string) => void;
  }) {
    this.roomCode = params.roomCode;
    this.localUid = params.localUid;
    this.onMicMapChange = params.onMicMapChange;
    this.onError = params.onError;

    this.init(params.peerUids);
  }

  private init(initialPeerUids: string[]) {
    if (typeof RTCPeerConnection === 'undefined') {
      this.onError('Voice chat is not supported in this browser.');
      return;
    }

    // Unlock suspended browser audio elements on the player's next tap/click anywhere
    this.unlockHandler = () => {
      this.resumeAllRemoteAudio();
    };
    window.addEventListener('pointerdown', this.unlockHandler, { passive: true });
    window.addEventListener('keydown', this.unlockHandler, { passive: true });

    // Publish initial muted state
    void this.publishMicState(false);

    // Subscribe to peer mic states (single equality filter -> no composite index required)
    const peersQ = query(
      collection(db, 'rooms', this.roomCode, 'voicePeers'),
      where('roomCode', '==', this.roomCode)
    );
    this.unsubPeers = onSnapshot(
      peersQ,
      (snap) => {
        if (this.disposed) return;
        const map: Record<string, boolean> = {};
        snap.docs.forEach((d) => {
          const data = d.data() as { uid?: string; micEnabled?: boolean };
          if (data.uid) {
            map[data.uid] = Boolean(data.micEnabled);
            if (data.uid !== this.localUid && !this.peers.has(data.uid)) {
              void this.ensurePeerConnection(data.uid);
            }
          }
        });
        this.onMicMapChange(map);
      },
      (err) => {
        if (!this.disposed) {
          this.onError(`Voice sync issue: ${err.message}`);
        }
      }
    );

    // Subscribe to WebRTC SDP / ICE signals for this room (single where clause -> no composite index needed!)
    const sigQ = query(
      collection(db, 'rooms', this.roomCode, 'voiceSignals'),
      where('roomCode', '==', this.roomCode)
    );
    this.unsubSignals = onSnapshot(
      sigQ,
      (snap) => {
        if (this.disposed) return;
        snap.docChanges().forEach((change) => {
          if (change.type !== 'added') return;
          const data = change.doc.data() as SignalDoc;
          if (data.toUid !== this.localUid) return;

          const docId = change.doc.id;
          if (this.processedSignals.has(docId)) return;
          this.processedSignals.add(docId);

          void this.handleSignal(data).finally(() => {
            void deleteDoc(doc(db, 'rooms', this.roomCode, 'voiceSignals', docId)).catch(() => {});
          });
        });
      },
      (err) => {
        if (!this.disposed) {
          this.onError(`Voice signal error: ${err.message}`);
        }
      }
    );

    // Pre-create RTCPeerConnections with known opponents so voice connects immediately
    initialPeerUids
      .filter((uid) => uid && uid !== this.localUid)
      .forEach((uid) => {
        void this.ensurePeerConnection(uid);
      });
  }

  private resumeAllRemoteAudio() {
    if (this.disposed) return;
    this.peers.forEach((record) => {
      record.audioEl.muted = this.speakerMuted;
      record.audioEl.volume = 1;
      if (record.audioEl.srcObject && record.audioEl.paused) {
        void record.audioEl.play().catch(() => {});
      }
    });
  }

  private async ensurePeerConnection(remoteUid: string): Promise<PeerRecord> {
    const existing = this.peers.get(remoteUid);
    if (existing) return existing;

    const pc = new RTCPeerConnection(RTC_CONFIG);

    // Attach invisible <audio> to DOM (avoid display:none/hidden so WebKit/Android never throttles playback)
    const audioEl = document.createElement('audio');
    audioEl.autoplay = true;
    audioEl.setAttribute('playsinline', 'true');
    audioEl.controls = false;
    audioEl.muted = this.speakerMuted;
    audioEl.volume = 1;
    audioEl.className = 'sr-only';
    document.body.appendChild(audioEl);

    let audioSender: RTCRtpSender | null = null;
    const localTrack = this.localStream?.getAudioTracks()[0] ?? null;

    if (localTrack && this.localStream) {
      audioSender = pc.addTrack(localTrack, this.localStream);
    } else {
      const transceiver = pc.addTransceiver('audio', { direction: 'sendrecv' });
      audioSender = transceiver.sender;
    }

    const record: PeerRecord = {
      remoteUid,
      pc,
      audioSender,
      pendingCandidates: [],
      audioEl,
      polite: this.localUid > remoteUid,
      makingOffer: false,
      ignoreOffer: false,
      isSettingRemoteAnswerPending: false,
    };
    this.peers.set(remoteUid, record);

    pc.ontrack = (event) => {
      if (this.disposed) return;
      const stream = event.streams[0] || new MediaStream([event.track]);
      if (audioEl.srcObject !== stream) {
        audioEl.srcObject = stream;
      }
      audioEl.muted = this.speakerMuted;
      audioEl.volume = 1;
      const tryPlay = () => {
        if (this.disposed) return;
        audioEl.muted = this.speakerMuted;
        void audioEl.play().catch(() => {
          // Will unlock cleanly on next user tap via unlockHandler or Mic button
        });
      };
      event.track.onunmute = tryPlay;
      tryPlay();
    };

    pc.onicecandidate = (event) => {
      if (this.disposed || !event.candidate) return;
      void this.sendSignal(remoteUid, 'ice', JSON.stringify(event.candidate.toJSON()));
    };

    pc.oniceconnectionstatechange = () => {
      if (this.disposed) return;
      if (pc.iceConnectionState === 'failed' && !record.polite) {
        void this.sendOffer(record, true);
      }
    };

    pc.onnegotiationneeded = async () => {
      if (this.disposed) return;
      await this.sendOffer(record, false);
    };

    // Initiator starts initial offer right away
    if (!record.polite) {
      await this.sendOffer(record, false);
    }

    return record;
  }

  private async sendOffer(record: PeerRecord, iceRestart: boolean) {
    const { pc, remoteUid } = record;
    if (this.disposed || record.makingOffer) return;
    if (!iceRestart && pc.signalingState !== 'stable') return;

    try {
      record.makingOffer = true;
      const offer = await pc.createOffer(iceRestart ? { iceRestart: true } : undefined);
      if (this.disposed) return;
      await pc.setLocalDescription(offer);
      if (pc.localDescription) {
        await this.sendSignal(remoteUid, 'offer', JSON.stringify(pc.localDescription));
      }
    } catch {
      // Non-fatal
    } finally {
      record.makingOffer = false;
    }
  }

  private async handleSignal(signal: SignalDoc) {
    if (this.disposed || !signal.fromUid || signal.fromUid === this.localUid) return;
    const record = await this.ensurePeerConnection(signal.fromUid);
    const { pc } = record;

    try {
      if (signal.type === 'offer') {
        const desc = JSON.parse(signal.payload) as RTCSessionDescriptionInit;
        const readyForOffer =
          !record.makingOffer &&
          (pc.signalingState === 'stable' || record.isSettingRemoteAnswerPending);
        const offerCollision = !readyForOffer;

        record.ignoreOffer = !record.polite && offerCollision;
        if (record.ignoreOffer) return;

        await pc.setRemoteDescription(new RTCSessionDescription(desc));

        // Ensure transceiver stays sendrecv so bidirectional voice works even after late mic unmute
        pc.getTransceivers().forEach((t) => {
          if (t.receiver.track?.kind === 'audio' && t.direction !== 'sendrecv') {
            t.direction = 'sendrecv';
          }
        });

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        if (pc.localDescription) {
          await this.sendSignal(signal.fromUid, 'answer', JSON.stringify(pc.localDescription));
        }
        await this.flushCandidates(record);
      } else if (signal.type === 'answer') {
        const desc = JSON.parse(signal.payload) as RTCSessionDescriptionInit;
        if (pc.signalingState === 'have-local-offer') {
          record.isSettingRemoteAnswerPending = true;
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(desc));
          } finally {
            record.isSettingRemoteAnswerPending = false;
          }
          await this.flushCandidates(record);
        }
      } else if (signal.type === 'ice') {
        const candidate = JSON.parse(signal.payload) as RTCIceCandidateInit;
        try {
          if (pc.remoteDescription) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } else {
            record.pendingCandidates.push(candidate);
          }
        } catch {
          if (!record.ignoreOffer) {
            // Ignore malformed or out-of-window ICE
          }
        }
      }
    } catch {
      // Ignore stale signaling packets
    }
  }

  private async flushCandidates(record: PeerRecord) {
    const queue = record.pendingCandidates.splice(0, record.pendingCandidates.length);
    for (const c of queue) {
      try {
        await record.pc.addIceCandidate(new RTCIceCandidate(c));
      } catch {
        // Ignore stale ICE
      }
    }
  }

  private async sendSignal(toUid: string, type: 'offer' | 'answer' | 'ice', payload: string) {
    if (this.disposed) return;
    try {
      await addDoc(collection(db, 'rooms', this.roomCode, 'voiceSignals'), {
        roomCode: this.roomCode,
        fromUid: this.localUid,
        toUid,
        type,
        payload,
        createdAt: serverTimestamp(),
      });
    } catch {
      // Ignore if room ended
    }
  }

  private async publishMicState(enabled: boolean) {
    if (this.disposed) return;
    const peerRef = doc(db, 'rooms', this.roomCode, 'voicePeers', this.localUid);
    try {
      const snap = await getDoc(peerRef);
      if (snap.exists()) {
        await updateDoc(peerRef, {
          micEnabled: enabled,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(peerRef, {
          roomCode: this.roomCode,
          uid: this.localUid,
          micEnabled: enabled,
          updatedAt: serverTimestamp(),
        });
      }
    } catch {
      // Non-fatal if room already finished
    }
  }

  async toggleMic(): Promise<boolean> {
    if (this.disposed) return false;
    // Unlock audio elements synchronously inside click gesture before async permission await
    this.resumeAllRemoteAudio();
    const next = !this.micEnabled;

    if (next) {
      if (!this.localStream) {
        if (!navigator.mediaDevices?.getUserMedia) {
          this.onError('Microphone access is unavailable in this browser (HTTPS required).');
          return false;
        }
        try {
          this.localStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          });
          const track = this.localStream.getAudioTracks()[0] || null;
          if (track) {
            track.enabled = true;
            await Promise.all(
              Array.from(this.peers.values()).map(async (record) => {
                if (record.audioSender) {
                  await record.audioSender.replaceTrack(track);
                  if (typeof record.audioSender.setStreams === 'function' && this.localStream) {
                    record.audioSender.setStreams(this.localStream);
                  }
                } else {
                  record.audioSender = record.pc.addTrack(track, this.localStream!);
                }
                record.pc.getTransceivers().forEach((t) => {
                  if (t.sender === record.audioSender && t.direction !== 'sendrecv') {
                    t.direction = 'sendrecv';
                  }
                });
                // Renegotiate so remote peer immediately binds the active microphone stream
                await this.sendOffer(record, false);
              })
            );
          }
        } catch {
          this.onError('Microphone permission denied. Allow mic access to talk.');
          return false;
        }
      }
      this.localStream.getAudioTracks().forEach((t) => {
        t.enabled = true;
      });
      this.resumeAllRemoteAudio();
    } else if (this.localStream) {
      this.localStream.getAudioTracks().forEach((t) => {
        t.enabled = false;
      });
    }

    this.micEnabled = next;
    await this.publishMicState(next);
    return next;
  }

  setSpeakerMuted(muted: boolean) {
    this.speakerMuted = muted;
    this.peers.forEach((record) => {
      record.audioEl.muted = muted;
      if (!muted && record.audioEl.srcObject && record.audioEl.paused) {
        void record.audioEl.play().catch(() => {});
      }
    });
  }

  dispose() {
    this.disposed = true;
    if (this.unlockHandler) {
      window.removeEventListener('pointerdown', this.unlockHandler);
      window.removeEventListener('keydown', this.unlockHandler);
      this.unlockHandler = null;
    }
    if (this.unsubSignals) {
      this.unsubSignals();
      this.unsubSignals = null;
    }
    if (this.unsubPeers) {
      this.unsubPeers();
      this.unsubPeers = null;
    }
    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }
    this.peers.forEach((record) => {
      try {
        record.audioEl.pause();
        record.audioEl.srcObject = null;
        record.audioEl.remove();
        record.pc.close();
      } catch {
        // Ignore close errors
      }
    });
    this.peers.clear();

    void deleteDoc(doc(db, 'rooms', this.roomCode, 'voicePeers', this.localUid)).catch(() => {});
  }
}
