import React from 'react';
import ReactDOM from 'react-dom/client';

const App = () => {
	return <Child />;
};

const Child = () => {
	return (
		<div>
			<span>BigReact</span>
		</div>
	);
};

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(<App />);
