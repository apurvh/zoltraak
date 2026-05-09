import React from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import 'tldraw/tldraw.css'
import './styles.css'

createRoot(document.getElementById('root')!).render(
	<React.StrictMode>
		<App />
	</React.StrictMode>
)
