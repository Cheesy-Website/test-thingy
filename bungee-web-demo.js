let query = {
    'script': 'bungee-pro',
    'sampleRateOut': '44100',
    'channelCountOut': '2'
};

let bungeeProSource;

{
    const variables = window.location.search.substring(1).split('&');
    for (var i = 0; i < variables.length; ++i)
        query[variables[i].split('=')[0]] = variables[i].split('=')[1];
}

if ('extra' in query) {
    let e = document.createElement("script");
    e.setAttribute("src", query['extra']);
    document.body.appendChild(e);
}

let player = undefined;

const readFile = (source) => {
    return URL.createObjectURL(source); // memory leak
};

const readUrl = (source) => {
    return source;
};

const fieldsetInput = document.getElementById('fieldsetInput');
const selectSource = document.getElementById('selectSource');
const checkPlay = document.getElementById('checkPlay');
const playLabel = document.getElementById('playLabel');
const sliderPosition = document.getElementById('sliderPosition');
const spanPosition = document.getElementById('spanPosition');
const spanSpeed = document.getElementById('spanSpeed');
const sliderSpeed = document.getElementById('sliderSpeed');
const snapSpeed = document.getElementById("snapSpeed");
const spanPitch = document.getElementById('spanPitch');
const sliderPitch = document.getElementById('sliderPitch');
const snapPitch = document.getElementById("snapPitch");

const toTimeText = (seconds) => {
    const sign = seconds < 0 ? "-" : "";
    const absSeconds = Math.abs(seconds);
    const minutes = Math.floor(absSeconds / 60);
    const remainingSeconds = absSeconds % 60;
    return `${sign}${String(minutes).padStart(1, '0')}:${String(Math.floor(remainingSeconds)).padStart(2, '0')}`;
};

function addThenCallEventListener(target, event, listener) {
    target.addEventListener(event, listener);
    listener();
}

addThenCallEventListener(snapSpeed, "change", () => {
    sliderSpeed.setAttribute('step', snapSpeed.checked ? 1. : 1e-6);
    sliderSpeed.classList.toggle('snap', snapSpeed.checked);
    sliderSpeed.dispatchEvent(new Event('input'));
});

addThenCallEventListener(snapPitch, "change", () => {
    sliderPitch.setAttribute('step', snapPitch.checked ? 1 : 1e-6);
    sliderPitch.classList.toggle('snap', snapPitch.checked);
    sliderPitch.dispatchEvent(new Event('input'));
});

let scrubbing = false;
addThenCallEventListener(sliderPosition, 'input', () => {
    if (bungeeProSource) {
        bungeeProSource.speed = undefined;
        bungeeProSource.seek(sliderPosition.value);
    }
    scrubbing = true;
    spanPosition.innerText = toTimeText(sliderPosition.value);
});
addThenCallEventListener(sliderPosition, 'change', () => {
    if (bungeeProSource && checkPlay.checked)
        bungeeProSource.speed = sliderSpeed.value;
    if (bungeeProSource && !checkPlay.checked)
        bungeeProSource.seek();
    scrubbing = false;
});
addThenCallEventListener(sliderSpeed, 'input', () => {
    const speed = Number(sliderSpeed.value);
    if (bungeeProSource && checkPlay.checked)
        bungeeProSource.speed = speed;
    spanSpeed.innerText = `${Math.round(100 * speed)}%`;
});
addThenCallEventListener(sliderPitch, 'input', () => {
    const pitch = Number(sliderPitch.value);
    if (bungeeProSource)
        bungeeProSource.pitch = Math.pow(2, pitch / 12);
    spanPitch.innerText = `${pitch > 0 ? "+" : (pitch == 0 ? "" : "-")}${Math.abs(pitch).toFixed(1)}`;
});
checkPlay.addEventListener('change', () => {
    if (checkPlay.checked) {
        bungeeProSource.speed = sliderSpeed.value;
        bungeeProSource.seek(sliderPosition.value);
    } else {
        bungeeProSource.speed = undefined;
        bungeeProSource.seek();
    }
});

let sliderPositionSmooth = 0.; // remove
let position = 0.;

const cpu = document.getElementById('cpu');

function animate() {
    if (bungeeProSource && !isNaN(bungeeProSource.position) && !scrubbing) {
        sliderPosition.value = bungeeProSource.position;
        spanPosition.innerText = toTimeText(sliderPosition.value);
    }
    const usage = bungeeProSource ? bungeeProSource.workletThreadUsage : 0;
    const cpuUsagePercent = 100 * usage;
    cpu.style.width = `${100 - cpuUsagePercent}%`;
    cpu.innerText = cpuUsagePercent.toFixed(1) + '% audio thread usage';
    requestAnimationFrame(animate);
}

animate();

const containingElement = document.getElementById('player');

const loadWrapper = async (data) => {
    checkPlay.disabled = true;
    sliderPosition.disabled = true;

    try {
        fieldsetInput.classList.add('loading');
        sliderPosition.value = 0;

        import("./BungeeProSource.js").then(async (module) => {
            const BungeeProSource = module.BungeeProSource;
            const audioContext = new window.AudioContext({
                latencyHint: 'interactive',
                sampleRate: parseInt(query['sampleRateOut'])
            });
            const asset = { url: data };
            const source = await BungeeProSource.source(audioContext, asset);
            const processor = await BungeeProSource.processor(audioContext);

            if (bungeeProSource)
                bungeeProSource.stop();

            bungeeProSource = new BungeeProSource(source, processor);
            bungeeProSource.connect(audioContext.destination);

            document.getElementById("sample-rate-in").innerText = bungeeProSource.inputSampleRate * 1e-3 + " kHz in";
            document.getElementById("sample-rate-out").innerText = audioContext.sampleRate * 1e-3 + " kHz out";

            sliderPosition.value = bungeeProSource.loopStart = 0;
            sliderPosition.max = bungeeProSource.loopEnd = bungeeProSource.inputDuration;
            bungeeProSource.loop = true;

            sliderPosition.disabled = false;
            checkPlay.disabled = false;
            checkPlay.checked = true;
            checkPlay.dispatchEvent(new Event('change'));
            sliderSpeed.dispatchEvent(new Event('input'));
            sliderPitch.dispatchEvent(new Event('input'));
        });

    } catch (e) {
        window.onerror(e, "", 0, 0, 0);
    }
    fieldsetInput.classList.remove('loading');
};

document.getElementById('inputFile').addEventListener('change', (event) => {
    if (event.target.files.length == 1) {
        document.getElementById('filename').textContent = event.target.files[0].name;
        document.getElementById('input-local').checked = true;
        loadWrapper(readFile(event.target.files[0]));
    }
});

{
    const examples = ["SingingVoice", "trombone", "manyforms", "yesterday", "bugablue", "school", "thyme", "Bongo", "CastanetsViolin", "DrumSolo", "Glockenspiel", "Jazz", "Pop", "Stepdad", "SynthMono", "SynthPoly", "moonlight", "wrong"];
    for (let i = 0; i < examples.length; ++i) {
        let text = `${examples[i].charAt(0).toUpperCase()}${examples[i].slice(1)}`;
        selectSource.innerHTML += `<option value="${examples[i]}" ${i == 0 ? " selected" : ""}>${text}</option>`;
    }

    document.getElementById('selectSource').addEventListener('change', (e) => {
        document.getElementById('input-demo').checked = true;
        document.getElementById('filename').textContent = '';
        loadWrapper(readUrl(`audio/${document.getElementById('selectSource').value}.aac`));
    });
}

fieldsetInput.addEventListener('dragover', (e) => {
    e.preventDefault();
});

fieldsetInput.addEventListener('drop', async (e) => {
    e.preventDefault();
    if (e.dataTransfer.files.length == 1) {
        document.getElementById('inputFile').value = '';
        document.getElementById('filename').textContent = e.dataTransfer.files[0].name;
        document.getElementById('input-local').checked = true;
        loadWrapper(readFile(e.dataTransfer.files[0]));
    }
});

document.getElementById('input-local').addEventListener('change', async (e) => {
    e.target.checked = false;
    document.getElementById('inputFile').value = '';
    await unloadWrapper();
    document.getElementById('inputFile').click();
});

document.getElementById('input-demo').addEventListener('change', (e) => {
    document.getElementById('filename').textContent = '';
    loadWrapper(readUrl(`audio/${document.getElementById('selectSource').value}.aac`));
});

selectSource.disabled = false;

let errored = false;

proEdition = true;

window.onerror = function (message, source, line, col, error) {
    if (!errored) {
        document.getElementById('player').innerHTML =
            "<h2>Sorry...</h2>" +
            "<p>An error occurred loading the Bungee Web Player. Check that WebAssembly SIMD128 and AudioWorklet are supported by your browser.</p>" +
            "<p>" + source + ":" + line + "</p>" +
            "<p>" + message + "</p>";
        errored = true;
    }
};
