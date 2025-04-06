import { useLoader } from '@react-three/fiber'
import { type FolderSettings } from 'leva/dist/declarations/src/types'
import { useMemo } from 'react'
import { FileLoader } from 'three'

import { useControls } from './useControls'

interface Entry {
  manufacturer: string
  file: string
}

export function useColorGradingControls(
  folderSettings?: FolderSettings
): string | null {
  const data = useMemo(() => {
    const response = useLoader(FileLoader, '/clut/index.json', loader => {
      loader.setResponseType('json')
    })
    // Parse the response if it's a string, or convert from ArrayBuffer if needed
    return (typeof response === 'string' ? JSON.parse(response) : response) as Entry[]
  }, [])

  const films = useMemo(
    () =>
      data
        .map(({ manufacturer, file }) => [
          file.slice(0, -4),
          `clut/${manufacturer}/${file}`
        ])
        .sort(([a], [b]) => a.localeCompare(b))
        .reduce<Record<string, string>>(
          (films, [key, value]) => ({
            ...films,
            [key]: value
          }),
          {}
        ),
    [data]
  )

  const { enabled, film } = useControls(
    'color grading',
    {
      enabled: false,
      film: {
        options: films
      }
    },
    { collapsed: true, ...folderSettings },
    [films]
  )

  return enabled ? film : null
}
