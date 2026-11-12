import './lib/offline'
import React from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { OtherTabWarning } from './components/OtherTabWarning'
import '@excalidraw/excalidraw/index.css'
import './styles.css'

createRoot(document.getElementById('root')!).render(
	<React.StrictMode>
		<App />
		<OtherTabWarning />
	</React.StrictMode>
)
