`use strict`
import { ClapDetector } from "./clapDetector.js";

import * as idbHandler from "./idbHandler.js";
let CurrentSceneNumber = 0;

let InputBuffer = [];

const ICON_NOTE = "🎵";
const ICON_CLAP = "👐";
const ICON_STOMP = "👣";
const ICON_VOICE = "?";

const CLOSURE_WAIT_TIME = 5; // second

const BPM = 94;
const SECTION_LENGTH = 4;
const FONT_NAME =  "silver";


const noteImage = new Image();
noteImage.src = "/resources/assets/note.png";

const START_TIME_WINDOW_S = 1.5;
const TEST_SCORE = {
	"title": "デフォルトテストについてのアンケートのお願い",
	"instructions": [
		"リズムxアンケートで拍手か足踏みで回答するアンケートです。", 
		"これはデフォルトのファイルです",
		"あなたのテストテストについての態度を調査してります。", 
		"所要時間は3分です。"
	],
	"closure": [
		"回答内容を記録しました。",
		"ご協力ありがとうございました。"
	],
	"qandaa":[
		{
			"question": "質問1です。はてな？",
			"answer0": "質問1の答えA",
			"answer1": "質問1の答えB",
			"score":[
				true, false, false, false,
				false, false, false, false, 
				false, false, false, false, 
				false, false, false, false
			]
		},
		{
			"question": "質問2です。はてな？",
			"answer0": "質問2の答えA",
			"answer1": "質問2の答えB",
			"score":[
				true, false, false, false,
				false, false, false, false, 
				true, false, false, false, 
				false, false, false, false
			]
			
		},	
		{
			"question": "最最後の質問問です。はてな？",
			"answer0": "質問3の答えA",
			"answer1": "質問3の答えB",
			"score":[
				true, false, false, false,
				true, false, false, false, 
				true, false, false, false, 
				false, false, false, false
			]
			
		}

	]
}

let Data = TEST_SCORE;




window.addEventListener("load", async ()=>{

	

	const Signal = document.createElement("div");

	function emitSignal(name, detail){
		if(detail){
		const ev = new CustomEvent(name, {"detail": [...detail]});
		Signal.dispatchEvent(ev);
		}
		else{
			const ev = new CustomEvent(name);
			Signal.dispatchEvent(ev);
		}
	}
	const Scenes = document.querySelectorAll(".scene");

	function switchScene(i){
		Scenes.forEach(scene =>{
			scene.classList.remove("currentScene");
		});
		Scenes[i].classList.add("currentScene");
		CurrentSceneNumber = i;
		InputBuffer = [];
		emitSignal("sceneEnd", null);	
	}

	switchScene(0);

	// scene0
	const scoreInput = document.getElementById('scoreInput');
	const parentC = document.getElementById('parentC');
	const parentP = document.getElementById('parentP');
	const parentD = document.getElementById('parentD');
	const closeSetup = document.getElementById("closeSetup");
	const downloadListParent = document.getElementById("downloadListParent");
	const downloadListButton = document.getElementById("downloadListButton");
	const downloadListModal = document.getElementById("downloadListModal");

	// scene1
	const migiueContainer = document.getElementById('migiue-container');
	const showtoday = document.getElementById('showtoday'); // これは既にscriptタグで定義されてるけど、念のため
	const titleContainer = document.getElementById('title-container');
	const instructionsContainer = document.getElementById('instructions-container');
	const pressStartContainer = document.getElementById('press-start-container');
	const clapIcons = document.getElementById('clap-icons');
	const clapIcon1 = document.getElementById('clap-icon1');
	const clapIcon2 = document.getElementById('clap-icon2');
	const clapIcon3 = document.getElementById('clap-icon3');
	const btnSound = document.getElementById("btnSound");


	// scene2 (特になし)
	const tutorialVideo = document.getElementById("tutorialVideo");

	// scene3
	const inqInstruction = document.getElementById('inq-instruction');
	inqInstruction.innerText = "質問に該当する入力を行ってください。";
	const quesionNumberContainer = document.getElementById("quesionNumber-container");
	const questionContainer = document.getElementById('question-container');
	const answer0Container = document.getElementById('answer0-container');
	const answer1Container = document.getElementById('answer1-container');
	const music = document.getElementById("music");
	const scoreContainer = document.getElementById('score-container');
	const inqClosure = document.getElementById('inq-closure');
	const scoreCanvas = document.getElementById("scoreCanvas");
	const answer0Number = document.getElementById("answer0-number");
	const answer1Number = document.getElementById("answer1-number");

	const clapSound = document.getElementById("clapSound");
	const stompSound = document.getElementById("stompSound");


	const answerCircle = document.createElement("div");
	answerCircle.className = "highlight-circle";

	// scene4
	const closureContainer = document.getElementById('closure-container');


	const clapDetector = new ClapDetector(Signal, parentC, parentP, parentD);



	Signal.addEventListener("clapDetect", (e) => {
		console.warn("CLAP DETECTED!");
		console.info(e.detail);
		InputBuffer.push(e.detail);
		if(e.detail["type"] == "handClap"){
			clapSound.currentTime = 0;
			clapSound.play();
		}
		else if(e.detail["type"] == "hittingTable"){
			stompSound.currentTime = 0;
			stompSound.play();
		};
	});

	downloadListButton.addEventListener("pointerdown",async ()=>{
		downloadListModal.showModal();
		await idbHandler.downloadAllJson(downloadListParent);
	});
	
	const date = new Date();
	const SessionID = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}-${date.getHours()}-${date.getMinutes()}-${date.getSeconds()}`;
	await idbHandler.openOrCreateDatabase(SessionID);

	scoreInput.addEventListener("change", (e)=>{
		const file = e.target.files[0];

		if(file){
			const reader = new FileReader();
			reader.onload = (e) =>{
				try{
						const content = e.target.result;
					Data = JSON.parse(content);
					console.log("スコア読み込み");
					console.info(Data);
				}
				catch(error){
					console.error("json読み込みエラー: ", error);
				}
			}
			reader.readAsText(file);
		}
		else{
			console.log("fileない");
		}
	});
	
	{
		const title = document.createElement("p");
		title.innerText = Data.title;
		titleContainer.appendChild(title);

	}
	{
	const p = document.createElement("p")
		p.innerHTML = Data.instructions.join("<br>");
		instructionsContainer.appendChild(p);
	}

	closeSetup.addEventListener("pointerdown", ()=>{
		switchScene(1);
	})

	migiueContainer.addEventListener("pointerdown", ()=>{
		switchScene(0);
	});


	
	let CurrentQuestionNumber = 0;
	let CurrentPos = 0;
	let You = false;

	const ScoreCtx = scoreCanvas.getContext("2d");
	
	function ScoreBg(canvas, ctx){
		ctx.fillStyle = "white";
		ctx.fillRect(0,0,canvas.width, canvas.height);
		ctx.strokeStyle = "#000000";
		ctx.lineWidth = 1;
		ctx.strokeRect(0,0,canvas.width,canvas.height);

		ctx.beginPath();
		ctx.lineWidth = 2;
		ctx.moveTo(0, canvas.height/2);
		ctx.lineTo(canvas.width, canvas.height/2);
		ctx.stroke();



		const barGap = canvas.width/14;
		const barHeightUnit = canvas.height/7
		const barStartY = canvas.height/2 - barHeightUnit/2;
		const barEndY = canvas.height/2 + barHeightUnit/2;
		for (let i = 1; i < 14; i++){
			ctx.beginPath()
			ctx.strokeStyle = "black";
			ctx.lineWidth = 1;
			ctx.moveTo(i*barGap,barStartY);
			ctx.lineTo(i*barGap, barEndY);
			ctx.stroke();
		}

		const beatStart = [2,6,10]

		const beatbarStartY = canvas.height/2 - 3*barHeightUnit/2;
		const beatbarEndY = canvas.height/2 + 3*barHeightUnit/2;
		for(let i of beatStart){
			ctx.beginPath()
			ctx.strokeStyle = "black";
			ctx.lineWidth = 1.5;
			ctx.moveTo(i*barGap,beatbarStartY);
			ctx.lineTo(i*barGap, beatbarEndY);
			ctx.stroke();
		}
	}

	function ScoreDrawPosition(canvas, ctx, who, pos){  // posは1/8音符が0.25の-0.5~3に正規化
		const barGap = canvas.width/14;
		const text = who;
		const barHeightUnit = canvas.height/7;
		const h = barHeightUnit*5;
		
		ctx.fillStyle = "black";
		ctx.strokeStyle = "red";
		ctx.lineWidth = 3;
		ctx.font = String(barHeightUnit) + "px " + FONT_NAME;
		const offsetX = barGap*2;
		const y = canvas.height/2;
		const x = canvas.width/3 * pos + offsetX;

		ctx.beginPath();
		ctx.moveTo(x,y-h/2);
		ctx.lineTo(x,y+h/2);
		ctx.stroke();

		ctx.textAlign = "center";
		ctx.textBaseline = "top";
		ctx.fillText(text,x,0);
	}

	function ScorePutRhythm(canvas, ctx, rhythm){
		const barGap = canvas.width/14;
		ctx.strokeStyle = "black";
		const noteW = noteImage.width/20;
		const noteH = noteImage.height/20;
		const barHeightUnit = canvas.height/5;
		for (let i in rhythm){
			if(rhythm[i]){
				const offsetX = barGap*2;
				const x = offsetX + i*barGap;
				const y = canvas.height/2;
				//ctx.drawImage(noteImage, x-noteW/2, y-noteH/2, noteW,noteH);
				ctx.fillStyle = "black";
				ctx.textAlign = "center";
				ctx.textBaseline = "middle"
				const size = canvas.height/5;
				ctx.font = String(barHeightUnit) + "px " + FONT_NAME;
				ctx.fillText(ICON_NOTE, x,y);

			}
		}
		
	}

	function ScorePutInput(canvas, ctx, pos, type){		// posは1/8音符が0.25の-0.5~3に正規化
		const barGap = canvas.width/14;
		const barHeightUnit = canvas.height/5;
		const h = barHeightUnit*5;
		
		ctx.fillStyle = "black";
		ctx.strokeStyle = "black";
		ctx.font = String(barHeightUnit) + "px " + FONT_NAME;
		const offsetX = barGap*2;
		const y = canvas.height/2;
		const x = canvas.width/3 * pos + offsetX;

		ctx.fillStyle = "red";
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		if(type == "handClap"){
			ctx.fillText(ICON_CLAP, x,y);
		}
		else if(type == "hittingTable"){
			ctx.fillText(ICON_STOMP, x,y);
		}
		else if(type == "loudVoice"){
			ctx.fillText(ICON_VOICE, x,y);
		}
	}

	function putQA(n){  //data = [問題文, A0. A1]の単純配列
		quesionNumberContainer.innerText = n+1;
		questionContainer.innerText = Data.qandaa[n].question;
		answer0Container.innerText = Data.qandaa[n].answer0;
		answer1Container.innerText = Data.qandaa[n].answer1;
	}

	const AudioCtx = new AudioContext();
	const Source = AudioCtx.createMediaElementSource(music);
	Source.connect(AudioCtx.destination);

	let sessionStartTime = null;
	let prevTime = null;
	const MeasureLength = 60/BPM * SECTION_LENGTH;
	let Doing = false;

	let PrevQuestionNumber = -1;

	let SectionStartTime = 0;

	let endTime = null;
	let ready = false;
	let QAS = Data["qandaa"];
	let Result = new Array(QAS.length);

	let sessionDate = null;

	Signal.addEventListener("sceneEnd", async ()=>{
		switch (CurrentSceneNumber){
			case 0:		// これはセットアップ
				break;
			case 1:		// これはメニュー画面	
				Result = [];
				btnSound.addEventListener("ended", ()=>{
					ready = false;
					switchScene(3);  // デバッグ用
				});

				break;
			case 2:		// これはチュートリアル

				tutorialVideo.play();
				tutorialVideo.addEventListener("ended", ()=>{
					//tutorialVideo.pause();
					switchScene(3);
				});
				break;
			case 3:		// ゲーム画面
				const now = new Date();
				sessionDate = now.toISOString();
				QAS = Data["qandaa"]
				Result = new Array(QAS.length);
				PrevQuestionNumber = -1;
				CurrentQuestionNumber = 0;
				music.loop = true;
				music.currentTime = 0;
				if (AudioCtx.state === 'suspended') {
					AudioCtx.resume();
				}
				music.play(); // HTMLのaudio要素を再生！

				sessionStartTime = AudioCtx.currentTime;
				prevTime = sessionStartTime;
				Doing = true;



				break;
			case 4:		// ゲームオーバー画面
				music.pause();
				Doing = false;
				music.currentTime = 0;
				const text = Data["closure"].join("<br>");
				closureContainer.innerHTML = text;
				endTime = clapDetector.Now;
				ready = false;
				console.info(Result);
				console.log(sessionDate);
				let saveData = {"time:": sessionDate,"result": [...Result]};
				await idbHandler.saveDataToDatabase(SessionID, saveData);
				break;
		}
	});


	update();
	function update() {
		clapDetector.update();
		switch (CurrentSceneNumber){
			case 0:		// これはセットアップ
				break;
			case 1:		// これはメニュー画面
				if(!ready){
					const now = clapDetector.Now;
					const recentInputs = InputBuffer.filter(input => (now - input.time) <= START_TIME_WINDOW_S);
					const currentInputCount = recentInputs.length; 

					for (let icon of clapIcons.children){
						icon.classList.remove("clapRed");
					}
					for (let i = 1; i <= currentInputCount; i++ ){
						clapIcons.children[i-1].classList.add("clapRed");
					}

					// console.log(currentInputCount);
					if(currentInputCount >= 3){
						// なんかここに効果音でも出したい
						ready = true;
						btnSound.currentTime = 0;
						btnSound.play();

					}
				}
				

				break;
			case 2:		// これはチュートリアル
				break;
			case 3:		// ゲーム画面

				if(Doing){

				const currentTime = AudioCtx.currentTime;
				const timeDelta = currentTime - prevTime;
				const currentInputTime = clapDetector.Now;

				const currentTimeFromStart = currentTime - sessionStartTime;

				const q = parseInt(currentTimeFromStart/MeasureLength);
				const r = currentTimeFromStart % MeasureLength;

				let w = null;
				if(q % 2 == 0){
					w = "Teacher"
					You = false;
				}
				else{
					w = "You";
					You = true;
				}

				const pos = r/MeasureLength * 3
				CurrentPos = pos;

				ScoreBg(scoreCanvas,ScoreCtx);


				ScoreDrawPosition(scoreCanvas, ScoreCtx, w, pos);

				if(pos > 2.5){
					let w2 = null;
					if(q % 2 == 0){
						w2 = "You"
					}
					else{
						w2 = "Teacher";
					}

					ScoreDrawPosition(scoreCanvas, ScoreCtx, w2, pos-3);
				}

				// ここから問題文
				const questionNumber = parseInt(q / 2);
				
				const n = questionNumber


				if(n >= QAS.length){	// 問題が全て終わったら終わる
					switchScene(4);
				}
					else{
						//const n = questionNumber % QAS.length; // くりかえすよ

						putQA(n, QAS[n]["question"],QAS[n]["answer0"], QAS[n]["answer1"], questionContainer, quesionNumberContainer, answer0Container, answer1Container);

						CurrentQuestionNumber = n;


						// ここからリズム
						ScorePutRhythm(scoreCanvas, ScoreCtx, QAS[n]["score"]);
						

						const ato = QAS.length - n - 1;
						if(ato == 0){
							inqClosure.innerText = "この問題が最後です。"
						}
						else {
							inqClosure.innerText = "あと" + String(ato) + "問です。 次にのページに進みます"; 
						}

						if(CurrentQuestionNumber !== PrevQuestionNumber){
							PrevQuestionNumber = CurrentQuestionNumber;
							SectionStartTime = currentInputTime;
							console.log("問題が変わった", SectionStartTime);
							// 問題が変わったら、丸付けも解除
							const anss = [answer0Number, answer1Number];

							for (const ans of anss){
								const children = ans.children;
								for (let child of children) {
									if( child == answerCircle){
										ans.removeChild(answerCircle);
									}
								}
							}
						


							// prevqn についてのここで回答結果の保存
						}

						// ここから回答の記録をしたい
						if(You){
							const sectionTime = currentInputTime - SectionStartTime - MeasureLength;  // Youがスタートしてから、いままでの時間
							const recentInputs = InputBuffer.filter(input => (currentInputTime - input.time) <= sectionTime*1.05);

							for (const input of recentInputs){
							//for (let i = recentInputs.length -1; i >= 0; i--){

								const pos = (input["time"] - SectionStartTime - MeasureLength)/MeasureLength * 3
								const type = input["type"]; // hittingTable, loudVoice, handClap
								ScorePutInput(scoreCanvas, ScoreCtx, pos, type);	


							}
							// ここから回答を丸付け
							const anss = [answer0Number, answer1Number];



							for (const ans of anss){
								const children = ans.children;
								for (let child of children) {
									if( child == answerCircle){
										ans.removeChild(answerCircle);
									}
								}
							}
							
							const mostRecentInput = InputBuffer[InputBuffer.length-1];
							
							if(mostRecentInput){
								if((currentInputTime - mostRecentInput.time) <= sectionTime*1.05){
									if( mostRecentInput["type"] == "hittingTable"){
										answer1Number.appendChild(answerCircle);
										Result[CurrentQuestionNumber] = 1;

									}
									else if(mostRecentInput["type"] == "handClap"){
										answer0Number.appendChild(answerCircle);
										Result[CurrentQuestionNumber] = 0;

									}
								}
							}
						}

					}
				}

				break;
			case 4:		// ゲームオーバー画面
				const currentTime = clapDetector.Now;
				if(currentTime - endTime > CLOSURE_WAIT_TIME){
					switchScene(1);
				}
				break;
		}


		window.requestAnimationFrame(update);

	}

});
