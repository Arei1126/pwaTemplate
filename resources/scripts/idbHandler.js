// idbHandler.js
const DB_NAME = 'myAwesomeDB'; // デフォルトのデータベース名、後で変更できるようにするよ
const DB_VERSION = 1; // データベースのバージョン、スキーマ変更したら増やすんだ

/**
 * IndexedDBデータベースをオープンまたは作成する関数
 * @param {string} dbName - 作成またはオープンするデータベースのID（名前）
 * @returns {Promise<IDBDatabase>} - データベースオブジェクトを解決するPromise
 */
export async function openOrCreateDatabase(dbName = DB_NAME) {
  return new Promise((resolve, reject) => {
    // データベースを開くリクエストを送るよ
    const request = indexedDB.open(dbName, DB_VERSION);

    // データベースが初めて作られるか、バージョンがアップグレードされたときに呼ばれるイベント！
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      // オブジェクトストア（データを入れる箱みたいなもん）がなかったら作るよ
      if (!db.objectStoreNames.contains('dataStore')) {
        db.createObjectStore('dataStore', { keyPath: 'id', autoIncrement: true });
        console.log(`オブジェクトストア 'dataStore' が ${dbName} に作成されました！`);
      }
    };

    // 成功したらPromiseを解決！
    request.onsuccess = (event) => {
      console.log(`データベース ${dbName} が正常にオープンされました！`);
      resolve(event.target.result);
    };

    // エラーが出たらPromiseを拒否するよ
    request.onerror = (event) => {
      console.error(`データベース ${dbName} のオープン中にエラーが発生しました:`, event.target.error);
      reject(event.target.error);
    };
  });
}

/**
 * IndexedDBにJSONデータを保存する関数
 * @param {string} dbName - データ保存先のデータベースID（名前）
 * @param {object} jsonData - 保存するJSONデータ
 * @returns {Promise<number>} - 保存されたデータのID（keyPathで指定したid）を解決するPromise
 */
export async function saveDataToDatabase(dbName, jsonData) {
  // まずデータベースを開くよ
  const db = await openOrCreateDatabase(dbName);

  return new Promise((resolve, reject) => {
    // トランザクションを開始！読み書きモードでね
    const transaction = db.transaction(['dataStore'], 'readwrite');
    const objectStore = transaction.objectStore('dataStore');

    // データをオブジェクトストアに追加するリクエストを送るよ
    const request = objectStore.add(jsonData);

    // 成功したらデータのIDを解決！
    request.onsuccess = (event) => {
      console.log(`データが ${dbName} に正常に保存されました！ ID: ${event.target.result}`);
      resolve(event.target.result);
    };

    // エラーが出たら拒否！
    request.onerror = (event) => {
      console.error(`データの保存中にエラーが発生しました:`, event.target.error);
      reject(event.target.error);
    };

    // トランザクションが完了したときのイベント
    transaction.oncomplete = () => {
      console.log('データの保存トランザクションが完了しました！');
    };

    // トランザクション中にエラーがあったときのイベント
    transaction.onerror = (event) => {
      console.error('データ保存トランザクション中にエラーが発生しました:', event.target.error);
    };
  });
}

/**
 * 全てのIndexedDBデータベースからデータを検索し、JSONの配列として返す関数
 * 注意: この関数はブラウザのセキュリティ制約により、直接全てのデータベース名を列挙できません。
 * したがって、事前に知っているデータベース名リストを渡す必要があります。
 *
 * @param {string[]} knownDbNames - 検索対象となる既知のデータベースID（名前）の配列
 * @returns {Promise<Object[]>} - 見つかった全てのJSONデータを解決するPromise
 */
export async function getAllDataFromDatabases() {
	const alldb = await indexedDB.databases();
	
	let knownDbNames = [];
	for (const snapdb of alldb){
		knownDbNames.push(snapdb.name);
	}

	const allData = [];


  // 各データベースをループしてデータを取得するよ
  for (const dbName of knownDbNames) {
    try {
      const db = await openOrCreateDatabase(dbName); // データベースを開く
      
      const dataForDb = await new Promise((resolve, reject) => {
        // 読み込みモードでトランザクションを開始！
        const transaction = db.transaction(['dataStore'], 'readonly');
        const objectStore = transaction.objectStore('dataStore');
        
        // オブジェクトストアの全てのデータを取得するリクエスト
        const request = objectStore.getAll(); // これで全部取れるんだ！

        // 成功したらデータを追加！
        request.onsuccess = (event) => {
          console.log(`${dbName} からデータが見つかりました:`, event.target.result);
          resolve(event.target.result);
        };

        // エラーが出たら拒否！
        request.onerror = (event) => {
          console.error(`データベース ${dbName} からデータの取得中にエラーが発生しました:`, event.target.error);
          reject(event.target.error);
        };
      });
      
      // 見つかったデータを全体リストに追加！
      //allData.push(...dataForDb);
      allData.push({"dbName": dbName, "data": [...dataForDb]});

    } catch (error) {
      console.error(`データベース ${dbName} の処理中にエラーが発生しました:`, error);
      // エラーが発生しても、他のDBの処理は続けるよ
    }
  }
  
  console.log("全ての検索が完了しました！見つかったデータ:", allData);
  return allData;
}

export function createDownloadUrl(jsonData, filename = 'download.json') {
  // 1. JSONデータを文字列にする
  // JSON.stringify()はJavaScriptのオブジェクトをJSON形式の文字列に変換してくれるよ！
  // 第3引数の2は、インデント（字下げ）のスペース数。見やすく整形されるんだ！
  const jsonString = JSON.stringify(jsonData, null, 2);

  // 2. その文字列をデータURLにする
  // encodeURIComponentでURLに使えない文字をエスケープするよ。
  // 'data:application/json;charset=utf-8,' の部分は「これはJSONデータで、UTF-8だよ！」ってブラウザに教えてるんだ！
  const dataUrl = 'data:application/json;charset=utf-8,' + encodeURIComponent(jsonString);

  return dataUrl;
}

export function downloadJson(jsonData, filename = 'data.json') {
  // ダウンロードURLを生成するよ
  const url = createDownloadUrl(jsonData, filename);

  // 3. ダウンロードリンクを作る (見えないリンクを一時的に作るんだ！)
  const a = document.createElement('a'); // <a>タグを新しく作るよ
  a.href = url; // データのURLをリンクの行き先に設定
  a.download = filename; // ここがマジ重要！この属性があると、クリックしたときにダウンロードが始まるんだ！
	a.innerText = filename
	return a
}

export async function downloadAllJson(parentElement, ignoreEmpty = true){
	parentElement.innerHTML = "";
	const datas = await getAllDataFromDatabases();
	for (const data of datas){
		if(data.data.length !== 0 || !ignoreEmpty){
			const a = downloadJson(data.data, data.dbName);
			parentElement.appendChild(a);
			const br = document.createElement("br");
			parentElement.appendChild(br);
		}
	}

}
