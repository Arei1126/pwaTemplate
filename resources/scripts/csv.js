
`use strict` 



export function ArrayToCSV(data) {
	if(data.length == 0){
		return;
	}
	const csvRows = [];
	const headers = Object.keys(data[0]);
	csvRows.push(headers.join(','));

	for (const row of data) {

		/*
		const val = [];
		for (const data of row){
			val.push(data);
		}
		*/
		const values = headers.map(header => row[header]);
		csvRows.push(values.join(','));
	}

	return csvRows.join('\r\n');
}

export function CSVtoBlob(csv){
	if(csv == null){
		return;
	}

	const blob = new Blob([csv],{type: "text/csv"});
	return blob;
}

export function DownloadBlob(blob, pElement,name){
	if(blob == null){
		return
	}


	const a = document.createElement("a");
	a.innerText = name;
	a.href = URL.createObjectURL(blob);
	a.download = name;
	pElement.appendChild(a);
	
	const br = document.createElement("br");
	pElement.appendChild(br);
}

