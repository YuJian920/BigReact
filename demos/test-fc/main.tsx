import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';

const App = () => {
	return <Child />;
};

const Child = () => {
	const [num, setNum] = useState(100);
	window.setNum = setNum;
	return <div>{num === 3 ? <span>is three</span> : <span>{num}</span>}</div>;
};

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(<App />);
