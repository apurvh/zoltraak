import React from 'react'

const HEARTBEAT_MS = 30_000
// Hidden tabs can run their timers as rarely as once a minute.
const PEER_TIMEOUT_MS = 3 * 60_000

export function OtherTabWarning() {
	const [hasOtherTab, setHasOtherTab] = React.useState(false)

	React.useEffect(() => {
		if (typeof BroadcastChannel === 'undefined') return
		const channel = new BroadcastChannel('zoltraak-tab-presence')
		const tabId = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)
		const peers = new Map<string, number>()
		const send = (type: 'hello' | 'present' | 'leave') => channel.postMessage({ type, tabId })
		const discover = () => send('hello')
		const leave = () => {
			send('leave')
			peers.clear()
			setHasOtherTab(false)
		}
		const onVisible = () => {
			if (document.visibilityState === 'visible') discover()
		}

		channel.onmessage = ({ data }) => {
			if (!data || typeof data.tabId !== 'string' || data.tabId === tabId) return
			if (data.type === 'leave') {
				peers.delete(data.tabId)
			} else if (data.type === 'hello' || data.type === 'present') {
				peers.set(data.tabId, Date.now())
				if (data.type === 'hello') send('present')
			} else {
				return
			}
			setHasOtherTab(peers.size > 0)
		}

		discover()
		const timer = window.setInterval(() => {
			if (!peers.size) return
			const expiredBefore = Date.now() - PEER_TIMEOUT_MS
			for (const [id, lastSeen] of peers) {
				if (lastSeen < expiredBefore) peers.delete(id)
			}
			setHasOtherTab(peers.size > 0)
			if (peers.size) send('present')
		}, HEARTBEAT_MS)
		window.addEventListener('pagehide', leave)
		window.addEventListener('pageshow', discover)
		document.addEventListener('visibilitychange', onVisible)
		return () => {
			window.clearInterval(timer)
			window.removeEventListener('pagehide', leave)
			window.removeEventListener('pageshow', discover)
			document.removeEventListener('visibilitychange', onVisible)
			send('leave')
			channel.close()
		}
	}, [])

	return (
		<div className="other-tab-warning" role="status">
			{hasOtherTab && <p>Another tab has this canvas open. Close the other tabs before editing to avoid losing changes.</p>}
		</div>
	)
}
