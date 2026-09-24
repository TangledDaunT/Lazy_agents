const orb = document.getElementById('orb');
const transcript = document.getElementById('transcript');
const correction = document.getElementById('correction');
const canvas = document.getElementById('wave');
const ctx = canvas.getContext('2d');
let listening = false;
let stream;
let analyser;
let previousTranscript = '';

function resizePill() {
  const width = Math.max(60, Math.min(420, transcript.scrollWidth + 44));
  window.hermesVoice?.resizeOverlay(width);
  orb.style.width = `${width}px`;
}

async function startAudio() {
  if (!navigator.mediaDevices?.getUserMedia) return;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const context = new AudioContext();
    analyser = context.createAnalyser();
    analyser.fftSize = 128;
    context.createMediaStreamSource(stream).connect(analyser);
  } catch (error) {
    transcript.textContent = `Microphone unavailable: ${error.message}`;
  }
}

function stopAudio() {
  stream?.getTracks().forEach((track) => track.stop());
  stream = undefined;
  analyser = undefined;
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!listening) return;
  const values = analyser ? new Uint8Array(analyser.frequencyBinCount) : null;
  analyser?.getByteTimeDomainData(values);
  ctx.beginPath();
  for (let x = 0; x <= canvas.width; x += 4) {
    const index = values ? Math.min(values.length - 1, Math.floor(x / canvas.width * values.length)) : 0;
    const amplitude = values ? (values[index] - 128) / 128 : Math.sin(x / 18 + performance.now() / 180) * .08;
    const y = 36 + amplitude * 28;
    x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.strokeStyle = 'rgba(118, 202, 255, .8)';
  ctx.lineWidth = 2;
  ctx.stroke();
  requestAnimationFrame(draw);
}

window.hermesVoice?.onOverlayEvent((event) => {
  if (event.type === 'wake') {
    listening = true;
    orb.className = 'listening';
    transcript.textContent = '';
    startAudio();
    draw();
    resizePill();
  } else if (event.type === 'partial_transcript') {
    correction.textContent = previousTranscript;
    transcript.textContent = event.text;
    resizePill();
  } else if (event.type === 'transcript') {
    previousTranscript = transcript.textContent;
    correction.textContent = previousTranscript && previousTranscript !== event.text ? previousTranscript : '';
    transcript.textContent = event.text;
    resizePill();
  } else if (event.type === 'running') {
    listening = false;
    stopAudio();
    orb.className = 'running';
    transcript.textContent = event.text || 'Working…';
    resizePill();
  } else if (event.type === 'error') {
    listening = false;
    stopAudio();
    orb.className = 'error';
    transcript.textContent = event.text;
    resizePill();
    setTimeout(() => {
      if (orb.className === 'error') {
        orb.className = 'idle';
        transcript.textContent = '';
        resizePill();
      }
    }, 2500);
  } else if (event.type === 'idle') {
    listening = false;
    stopAudio();
    orb.className = 'idle';
    transcript.textContent = '';
    correction.textContent = '';
    resizePill();
  }
});
