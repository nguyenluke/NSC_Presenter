import React, { lazy, Suspense, useMemo } from 'react'
import { OperatorStudioView } from './views/OperatorStudioView'
import { IdentifyBadgeView, OutputWindowView } from './views/OutputWindowView'
const PdfRenderView = lazy(() => import('./views/PdfRenderView').then(module => ({ default: module.PdfRenderView })))

export const App: React.FC = () => {
  const route = useMemo(() => {
    const rawHash = window.location.hash.replace(/^#/, '') || 'operator'
    const [pathPart, queryPart = ''] = rawHash.split('?')
    const params = new URLSearchParams(queryPart)
    return { pathPart, params }
  }, [])

  if (route.pathPart === 'pdf-render') return <Suspense fallback={null}><PdfRenderView /></Suspense>
  if (route.pathPart === 'output') {
    const profileId = route.params.get('profileId') || route.params.get('role') || 'audience-main'
    return <OutputWindowView profileId={profileId} />
  }

  if (route.pathPart === 'identify') {
    return (
      <IdentifyBadgeView
        num={route.params.get('num') || '1'}
        label={route.params.get('label') || 'Physical Screen'}
      />
    )
  }

  return <OperatorStudioView />
}
