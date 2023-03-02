import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';

const App = () => {
	return <Child />;
};

const Child = () => {
	const [num, setNum] = useState(100);
	return <div onClick={() => setNum(num + 100)}>{num}</div>;
};

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(<App />);
