import React from 'react'
import { Editor, Tldraw, type TLUiOverrides } from 'tldraw'
import { PageSwitcher } from './components/PageSwitcher'
import { installTestApi, uninstallTestApi } from './testing/installTestApi'

export function App() {
	const [isPageSwitcherOpen, setIsPageSwitcherOpen] = React.useState(false)

	const closePageSwitcher = React.useCallback(() => {
		setIsPageSwitcherOpen(false)
	}, [])

	const handleMount = React.useCallback((editor: Editor) => {
		installTestApi(editor)
	}, [])

	const overrides = React.useMemo<TLUiOverrides>(
		() => ({
			actions(_editor, actions) {
				actions['open-page-switcher'] = {
					id: 'open-page-switcher',
					label: 'Open page switcher',
					kbd: 'cmd+k,ctrl+k',
					readonlyOk: true,
					onSelect() {
						setIsPageSwitcherOpen(true)
					},
				}

				return actions
			},
		}),
		[]
	)

	React.useEffect(() => {
		return () => {
			uninstallTestApi()
		}
	}, [])

	return (
		<main className="app-shell">
			<Tldraw overrides={overrides} persistenceKey="zoltraak-canvas" onMount={handleMount}>
				<PageSwitcher isOpen={isPageSwitcherOpen} onClose={closePageSwitcher} />
			</Tldraw>
		</main>
	)
}
