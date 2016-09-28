VList-JS
===

Documentation coming soon...

Example
```js
let names = [...];
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
		element.addEventListener('click', (e) => {
			let idx = parseInt(e.currentTarget.attributes["data-index"]);
			let name = names[idx];
			selectedNameIndex = idx;
			vlist.changed(index);
		});
	}
});
```