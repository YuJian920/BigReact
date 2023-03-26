import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';

// function App() {
// 	const [num, setNum] = useState(100);

// 	const arr =
// 		num % 2 === 0
// 			? [<li key="1">1</li>, <li key="2">2</li>, <li key="3">3</li>]
// 			: [<li key="3">3</li>, <li key="2">2</li>, <li key="1">1</li>];

// 	return <ul onClickCapture={() => setNum(num + 1)}>{arr}</ul>;
// }

function App() {
	const [num, updateNum] = useState(0);
	useEffect(() => {
		console.log('App mount');
	}, []);

	useEffect(() => {
		console.log('num change create', num);
		return () => {
			console.log('num change destroy', num);
		};
	}, [num]);

	return <div onClick={() => updateNum(num + 1)}>{num === 0 ? <Child /> : 'noop'}</div>;
}

function Child() {
	useEffect(() => {
		console.log('Child mount');
		return () => console.log('Child unmount');
	}, []);

	return 'i am child';
}

function Child2() {
	const [num, setNum] = useState(0);

	return (
		<div
			onClick={() => {
				setNum((num) => num + 1);
				setNum((num) => num + 1);
				setNum((num) => num + 1);
			}}
		>
			<span>big-react</span>
			{num >= 3 ? <div>mini-vue</div> : <span>mini-soild</span>}
		</div>
	);
}

function NewTest() {
	const arr = [<li>3</li>, <li>4</li>];
	return (
		<ul>
			<>
				<li>1</li>
				<li>2</li>
			</>
			{arr}
		</ul>
	);
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(<App />);
