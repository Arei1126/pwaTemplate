import * as CSV from "./csv.js";

const storeName = "text";

export async function downloadAllCSV(parentElement) {
	let alldb = await indexedDB.databases();
	
	for (const snapdb of alldb){
		const dbName = snapdb.name;

		let open = indexedDB.open(dbName);

		open.onsuccess = (e) => {
			const db = e.target.result;

			const trans = db.transaction(storeName, "readonly");
			const store = trans.objectStore(storeName);

			const getAllReq = store.getAll();

			getAllReq.onsuccess = (e) => {
				const data = e.target.result;
				const csv = CSV.ArrayToCSV(data);
				const blob = CSV.CSVtoBlob(csv);
				CSV.DownloadBlob(blob,parentElement,dbName);
			}


		}
	}

}

export function createNewDb(dbName){

	let open = indexedDB.open(dbName);

	open.onupgradeneeded = (e) => {
		let db = e.target.result;
		db.createObjectStore(storeName, {keyPath: "ID", autoIncrement: true});
		console.log(`created ${dbName}`);

	}

	open.onsuccess = (e) => {
		const db = e.target.result;
		db.close();
	}
}

export function write(dbName,dataArray){
	

	let open = indexedDB.open(dbName);

	open.onsuccess = (e) => {
		const db = e.target.result;


		let trans = db.transaction(storeName, "readwrite");
		let store = trans.objectStore(storeName);

		trans.oncomplete = () => {
			console.log("all data wrote");
		};

		for (const data of dataArray){
			let putReq = store.put(data);

			putReq.onsuccess = () => {
				console.log(`wrote ${data}`);
			};
		};

	};


}
