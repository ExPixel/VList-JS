/**
 * A terrible demo that I need to clean up.

 */

const RECORDS = 10000;
let messageContainer = document.getElementById('message');
let messageContainer2 = document.getElementById('message2');

function showMessage(m) {
	messageContainer.innerText = m;
}

function showMessage2(m) {
	messageContainer2.innerText = m;
}

showMessage('Click on an item');

let created = 0;
let elementsCreated = 0;
let names = [];
let selectedNameIndex = 0;
let vlist;
vlist = VList.init({
	container: '#list',

	template: `
		<div class="list-item">
			<span vlist-name="index"></span>
			<span vlist-name="firstName"></span>
			<span vlist-name="lastName"></span>
		</div>
	`,

	elementHeight: 80,

	templateRender: function(index, templateData) {
		if (index % 2 == 1) { templateData.$root.classList.add("other"); }
		else { templateData.$root.classList.remove("other"); }

		if (index === selectedNameIndex) { templateData.$root.classList.add("selected"); }
		else { templateData.$root.classList.remove("selected"); }

		let name = names[index];
		templateData.index.innerText = index + "";
		templateData.firstName.innerText = name.firstName;
		templateData.lastName.innerText = name.lastName;
		templateData.$root.attributes["data-index"] = index;
	},

	onCreateElement: function(index, element) {
		elementsCreated++;
		showMessage2(`Created ${elementsCreated} elements.`);
		element.addEventListener('click', (e) => {
			let idx = parseInt(e.currentTarget.attributes["data-index"]);
			let name = names[idx];
			selectedNameIndex = idx;
			showMessage(`Clicked On "${name.firstName} ${name.lastName}" at index ${idx}.`);
			vlist.changed(index);
		});
	}
});

for (var i = 0; i < RECORDS; i++) {
	let firstName = faker.name.firstName();
	let lastName = faker.name.lastName();
	names.push({
		"firstName": firstName,
		"lastName": lastName
	});
}
vlist.inserted(0, RECORDS);