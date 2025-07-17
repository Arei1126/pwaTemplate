`use strict`


const PARA_HTML = `			
<div id="container_threshold">
			<label for="fix">Fix Offset</label>
			<input id="fix" type="number" >

			<label for="margin">Signal Margin</label>
			<input id="margin" type="number" >

			<label for="falling">Falling Margin</label>
			<input id="falling" type="number" >

			<label for="duration">Duration</label>
			<input id="duration" type="number" >

			<label for="centroid">Centroid</label>
			<input id="centroid" type="number" >
</div>
`;
const CANVAS_HTML = `
<div id="container_canvas">
			<div id="time" class="visualizer-section">
				<h2>Time</h2>
				<canvas id="waveformCanvas" class="detector" width="640" height="250"></canvas>
			</div>

			<div id="freq" class="visualizer-section">
				<h2>Freq</h2>
				<canvas id="spectrumCanvas" class="detector"width="640" height="250"></canvas>
			</div>
</div>
`;

const DETECTION_HTML = `
			<div id="detection">
			</div>

`;

export class ClapDetector  {



	constructor(signal, canvasParentElement, parameterParentElement, detectionParentElement) {
		this.userOperated = false;
		this.Signal = signal;
		this.RisingThreshold = 1;  // 初期値は全て背景ノイズであると仮定
		this.FallingThreshold = this.RisingThreshold * 0.7

		this.DurationThreshold = 0.2;
		this.CentroidThreshold = 3000;

		this.BackgroundNoiseLevel = 1;
		this.FIX_OFFSET = 0.1;
		this.SIGNAL_MARGIN = 5;

		this.FALLING_MARGIN = 0.7;

		this.RANGE_S = 0.05;  // 0.05秒以上の大音量を大声とする

		this.Detecting = false;
		parameterParentElement.innerHTML = PARA_HTML;
		canvasParentElement.innerHTML = CANVAS_HTML;
		detectionParentElement.innerHTML = DETECTION_HTML;


		const fixInput = document.querySelector("#fix");
		const marginInput = document.querySelector("#margin");

		const durationInput = document.querySelector("#duration");
		const fallingInput = document.querySelector("#falling");
		const centroidInput = document.querySelector("#centroid");

		durationInput.value = this.DurationThreshold;
		fallingInput.value = this.FallingThreshold;
		centroidInput.value = this.CentroidThreshold;
		fixInput.value = this.FIX_OFFSET;
		marginInput.value = this.SIGNAL_MARGIN;

		durationInput.addEventListener("input", (e)=>{
			this.DurationThreshold = parseFloat(e.target.value);
		});

		fallingInput.addEventListener("input", (e)=>{
			this.FallingThreshold = parseFloat(e.target.value);
		});

		centroidInput.addEventListener("input", (e)=>{
			this.CentroidThreshold = parseFloat(e.target.value);
		});


		fixInput.addEventListener("input", (e)=>{
			this.FIX_OFFSET = parseFloat(e.target.value);
		});
		marginInput.addEventListener("input", (e)=>{
			this.SIGNAL_MARGIN = parseFloat(e.target.value);
		})

		this.detection = document.querySelector("#detection");

		this.waveformCanvas = document.getElementById('waveformCanvas');
		this.spectrumCanvas = document.getElementById('spectrumCanvas');

		this.waveformCtx = waveformCanvas.getContext('2d');
		this.spectrumCtx = spectrumCanvas.getContext('2d');
		
		//this._boudMain = this.main.bind(this);
		window.document.addEventListener("pointerdown", this.main);
	};

	main = async () => {
		window.document.removeEventListener("pointerdown", this.main);
		this.userOperated = true;
	
	// 1. AudioContextを生成する！これが音を扱うための中心となるオブジェクト！
		this.audioContext = new (window.AudioContext || window.webkitAudioContext)();


		this.sampleRate = this.audioContext.sampleRate;
		this.SamplesT = [];
		this.SamplesF = [];
		this.Samples = [];
	
		// 2. AnalyserNodeを生成する！
		this.analyser = this.audioContext.createAnalyser();
		// FFTサイズを設定するよ。解析の細かさを決めるパラメータ。
		// 2のN乗で指定するよ。2048とか4096がよく使われるかな。
		// 2の累乗のFFTサイズ候補リスト
		const fftSizeCandidates = [
			32, 64, 128, 256, 512, 1024, 2048, 4096, 8192, 16384, 32768
		];

		let bestFftSize = 2048; // デフォルト値としてよく使われる2048を設定しとくよ
		let minDifference = Infinity;
	
		const targetSamples = this.RANGE_S*this.sampleRate;

		// 目標サンプル数に一番近い2の累乗を探す！
		for (const size of fftSizeCandidates) {
			const diff = Math.abs(targetSamples - size); // 差の絶対値
			if (diff < minDifference) {
				minDifference = diff;
				bestFftSize = size;
			}
		}
		this.bufferLength = bestFftSize
		console.log("fftsize: ", this.bufferLength);

		this.analyser.fftSize = this.bufferLength;
		this.analyser.minDecibels = -90; // dBレンジの最小値（これより小さい音は描画されない）
		this.analyser.maxDecibels = -10; // dBレンジの最大値（0dBだとノイズも拾うので少し下げると見やすい）
		this.analyser.smoothingTimeConstant = 0.85; // 時間方向の平滑化（0.0〜1.0、大きいほど変化がなだらかに）


		// 3. リアルタイムに周波数データを格納する配列を用意！
		this.dataArrayF = new Float32Array(this.analyser.fftSize);
		this.dataArrayT = new Float32Array(this.analyser.fftSize);

		// 4. マイクの音声を取得する準備！
		this.stream = await navigator.mediaDevices.getUserMedia({ audio: true })
		// 5. 取得したマイクの音声をAudioContextに繋げるSourceNodeを作成！
		this.source = this.audioContext.createMediaStreamSource(this.stream);



		/*
		const bandstopFilter = audioContext.createBiquadFilter();
		bandstopFilter.type = 'bandstop'; // 声の帯域をカットしたいからバンドストップ
		bandstopFilter.frequency.value = 1000; // 中心周波数 (例: 1000Hz)
		bandstopFilter.Q.value = 1.0; // Q値 (低いほど広い帯域に効く)
		// bandstopFilter.gain.value = 0; // bandstop/notchではgainは通常0


		// 2. ハイパスフィルターノードを作成するよ！
		const hpFilter = audioContext.createBiquadFilter();
		hpFilter.type = 'highpass'; // ここが 'highpass' に変わったよ！

		// 試してみてね！例: 300Hz, 500Hz, 800Hz, 1000Hz (1kHz) など
		hpFilter.frequency.value = 500; // 例: 500Hzより低い周波数をカット
		// Q値を設定 (デフォルトは1。低くすると緩やか、高くすると鋭くピークが発生)
		hpFilter.Q.value = 0.707; // 例: 自然な減衰のために0.707 (バターワース特性に近い)
		
		*/
		// 2. 何も変換しない「パススルーノード」としてGainNodeを作成するよ！
		const passThroughNode = this.audioContext.createGain();
		passThroughNode.gain.value = 1;


		this.filterNode = passThroughNode;
		this.source.connect(this.filterNode);
		this.filterNode.connect(this.analyser);
	}

	update = () => {

		if(this.userOperated){
		// しきい値設定
			this.RisingThreshold = Math.min(this.BackgroundNoiseLevel*this.SIGNAL_MARGIN+this.FIX_OFFSET, 1);
			this.FallingThreshold = this.RisingThreshold*this.FALLING_MARGIN;


			// AnalyserNodeから周波数データを取得！
			// getByteFrequencyData()を使うと、0-255の範囲で周波数ごとの音量を取得できるよ。
			this.analyser.getFloatFrequencyData(this.dataArrayF);
			this.analyser.getFloatTimeDomainData(this.dataArrayT);

			this.time = this.audioContext.currentTime;
			// ここでdataArrayを使って好きな処理をするよ！

			if(!this.Detecting){
				// 時間軸から、でかい音量を見つける
				for (const data of this.dataArrayT){
					if(Math.abs(data) > this.RisingThreshold){
						this.Detecting = true;
						this.Samples.push({"time":this.time, "dataArrayFreq": [...this.dataArrayF], "dataArrayTime": [...this.dataArrayT] });
						console.log("検出開始")
						break;
					}
				}
				// 検出中ではない、今回検出しなかった
				// 背景ノイズ推定
				const powerArray = this.dataArrayT.map(Math.abs)
				this.BackgroundNoiseLevel = powerArray.reduce((sum, n) => sum + n, 0)/powerArray.length;
			}
			else{
				// 検出中
				this.Detecting = false;
				for (const data of this.dataArrayT){
					if(Math.abs(data) > this.FallingThreshold){
						this.Detecting = true;
						this.Samples.push({"time":this.time, "dataArrayFreq": [...this.dataArrayF], "dataArrayTime": [...this.dataArrayT] });
						console.log("検出中");
						this.Detecting = true;
						break
					}
				}
				if(!this.Detecting){
					// １つも検出出来なかった
					this.Detecting = false;
					console.log("検出終了");
					// ここで処理
					
					/*
					let len = Samples.length;
					let mid = parseInt(len/2);
					console.log("中央データのインデックス: ", mid);
					console.log("中央値の最大値: ", Math.max(...Samples[mid]["dataArrayTime"]));

					*/

					console.info(this.Samples);
					
					let maxes = [];
					for (const sample of this.Samples){
						const data = sample["dataArrayTime"];
						let max = Math.max(...data)
						console.log("中央地: ", max);
						maxes.push(max);
					}

					let max = Math.max(...maxes)
					let maxi = maxes.indexOf(max)
					console.log("max index: ", maxi);
					console.info(this.Samples[maxi]);

					const sample = this.Samples[maxi]	
					function convertDbAmplitudeToLinear(dbValue) {
						return Math.pow(10, dbValue / 20);
					}

					const linearAmplitudeData = sample["dataArrayFreq"].slice(0,this.analyser.frequencyBinCount).map(convertDbAmplitudeToLinear);

					console.info(linearAmplitudeData);
					
					function calculateVariance(arr) {
						const n = arr.length; // データ点の数
						console.log("N:",n);

						// 配列が空だったら、標準偏差は計算できないよ！
						if (n === 0) {
							console.warn("警告: 空の配列の標準偏差は計算できません。0を返します。");
							return 0;
						}

						// ステップ1: 平均値 (Mean) を計算するよ！
						const sum = arr.reduce((accumulator, currentValue) => accumulator + currentValue, 0);
						const mean = sum / n;
						console.log(mean);

						// ステップ2: 各データと平均値の差を二乗して、その合計を計算するよ！
						// ステップ3: 二乗和をデータ数で割って、分散 (Variance) を計算するよ！
						const variance = arr.reduce((accumulator, currentValue) => {
							const diff = currentValue - mean;
							return accumulator + (diff * diff);
						}, 0) / n; // ここが「/ n」だから母標準偏差ね！

						// ステップ4: 分散の平方根を取る！それが標準偏差だよ！
						return variance;
					}

					const variance = calculateVariance(linearAmplitudeData);
					console.log("分散: ", variance);

					function calculateSpectralCentroid(freqData, sampleRate, fftSize) {

						let sumFreqAmplitude = 0;
						let sumAmplitude = 0;

						// 各周波数ビンの周波数と振幅を掛け合わせて合計するよ！
						for (let i = 0; i < linearAmplitudeData.length; i++) {
							// 各ビンの中心周波数を計算 (AnalyserNodeのgetFloatFrequencyDataは直流成分も含む)
							// ビン0は0Hz、ビンN/2はNyquist周波数 (sampleRate / 2)
							const binFrequency = i * (sampleRate / fftSize); 
							sumFreqAmplitude += binFrequency * linearAmplitudeData[i];
							sumAmplitude += linearAmplitudeData[i];
						}

						// 合計振幅がゼロの場合はNaNを返す可能性があるから注意！
						if (sumAmplitude === 0) {
							return 0; // または NaN, Infinity など、適切なエラーハンドリング
						}

						return sumFreqAmplitude / sumAmplitude;
					
					}

					const centroid = calculateSpectralCentroid(linearAmplitudeData, this.sampleRate, this.bufferLength);
					console.log("重心: ", centroid);

					const mode = linearAmplitudeData.indexOf(Math.max(...linearAmplitudeData));
					console.log("mode: ", mode);

					const duration  = this.Samples[this.Samples.length -1]["time"] - this.Samples[0]["time"]
					console.log("持続時間 ;" , duration);
					const len = this.Samples.length;
					console.log("サンプル数; ", len);

					let res = null;
					if(duration > this.DurationThreshold){
						const text = document.createElement("p");
						text.className = "fade-out-after-delay";
						text.innerText = "Detection: Loud voice"
						this.detection.prepend(text);
						res = "loudVoice";
					}
					else if( centroid < this.CentroidThreshold){
						const text = document.createElement("p");
						text.className = "fade-out-after-delay";
						text.innerText = "Detection: Hitting the table"
						this.detection.prepend(text);
						res = "hittingTable";

					}
					else{
						const text = document.createElement("p");
						text.className = "fade-out-after-delay";
						text.innerText = "Detection: Hand calp"
						this.detection.prepend(text);
						res = "handClap";

					}
					const content = {
						"time": this.Samples[0]["time"],
						"samples_length": len,
						"sample_time":this.Samples[maxi]["time"],
						"sampleT": [...this.Samples[maxi]["dataArrayTime"]],
						"sampleF":[...this.Samples[maxi]["dataArrayFreq"]],
						"sample_index": maxi,
						"duration": duration,
						"centroid": centroid,
						"mode": mode,
						"type": res
					}
					const ev = new CustomEvent("clapDetect",{detail:{...content},});
					this.Signal.dispatchEvent(ev);

					this.Samples = [];

				}

			}

		const draw = (timeData, freqData) => {
			if(timeData == null || freqData == null){
				return;
			}

			// --- 時間空間（波形）の描画 ---
			// 現在のバッファの生データを取得 (Float32Array, -1.0 to 1.0)

			// Canvasをクリア
			this.waveformCtx.clearRect(0, 0, this.waveformCanvas.width, this.waveformCanvas.height);

			// 描画設定
			this.waveformCtx.lineWidth = 1;
			this.waveformCtx.strokeStyle = 'rgb(0, 0, 0)'; // 波形の色

			this.waveformCtx.beginPath(); // 描画開始

			const sliceWidth = this.waveformCanvas.width * 1.0 / this.bufferLength; // 1データ点あたりの幅
			let x = 0;

			for (let i = 0; i < this.bufferLength; i++) {
				// データは-1.0から1.0なので、canvasの高さ0から高さにマッピングする
				const v = timeData[i] - 1; // 0.0から2.0にシフト
				const y = -v * this.waveformCanvas.height / 2; // canvasの高さにスケール

				if (i === 0) {
					this.waveformCtx.moveTo(x, y); // 最初の点
				} else {
					this.waveformCtx.lineTo(x, y); // 線を引く
				}

				x += sliceWidth; // 次の点のX座標
			}

			this.waveformCtx.lineTo(this.waveformCanvas.width, this.waveformCanvas.height / 2); // 最後を中央に繋いで見栄えを良く
			this.waveformCtx.stroke(); // 描画実行

			this.waveformCtx.beginPath()
			this.waveformCtx.strokeStyle = "red"
			let th =-( this.RisingThreshold - 1)*this.waveformCanvas.height /2
			this.waveformCtx.moveTo(0, th);
			this.waveformCtx.lineTo(this.waveformCanvas.width, th);
			this.waveformCtx.stroke();

			this.waveformCtx.beginPath()
			this.waveformCtx.strokeStyle = "blue"
			let thl =-( this.FallingThreshold - 1)*this.waveformCanvas.height /2
			this.waveformCtx.moveTo(0, thl);
			this.waveformCtx.lineTo(this.waveformCanvas.width, thl);
			this.waveformCtx.stroke();



			// --- 周波数空間（スペクトラム）の描画 ---
			// 周波数データを取得 (Float32Array, dB値)

			// Canvasをクリア
			this.spectrumCtx.clearRect(0, 0, this.spectrumCanvas.width, this.spectrumCanvas.height);

			// 棒グラフの設定
			const barWidth = (this.spectrumCanvas.width / this.analyser.frequencyBinCount) * 2.5; // 棒の幅
			let barHeight;
			let xBar = 0;

			for (let i = 0; i < this.analyser.frequencyBinCount; i++) {
				// dB値をcanvasの高さにマッピングする
				// analyser.minDecibels から analyser.maxDecibels の範囲を 0 から canvas.height に変換
				// データが小さい（静か）ほどマイナス値が大きいので、高さに変換する際に注意
				// 例: -90dBを高さ0に、0dBを最大高さに
				barHeight = (freqData[i] - this.analyser.minDecibels) * this.spectrumCanvas.height / (this.analyser.maxDecibels - this.analyser.minDecibels);
				// barHeightが負にならないように0でクリップ
				barHeight = Math.max(0, barHeight);


				// 色を音量で変えてみる！
				//const hue = i / analyser.frequencyBinCount * 360; // 周波数によって色相を変える
				//this.spectrumCtx.fillStyle = `hsl(${hue}, 100%, 50%)`; // 派手な色合いに！
				this.spectrumCtx.fillStyle = 'rgb(0, 0, 0)';

				// 棒を描画
				this.spectrumCtx.fillRect(xBar, this.spectrumCanvas.height - barHeight, barWidth, barHeight);

				xBar += barWidth + 1; // 棒の隙間

				this.spectrumCtx.beginPath()
				this.spectrumCtx.strokeStyle = "red"
				let th = 20*Math.log(this.RisingThreshold)
				th = (th - this.analyser.minDecibels)*this.spectrumCanvas.height / (this.analyser.maxDecibels - this.analyser.minDecibels);
				this.spectrumCtx.moveTo(0, th);
				this.spectrumCtx.lineTo(this.spectrumCtx.width, th);
				this.spectrumCtx.stroke();
			}
		};

		draw(this.dataArrayT, this.dataArrayF);


	}

	}
	get Now(){
		return this.audioContext.currentTime;
	}
}


