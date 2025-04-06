import {
  EffectComposer as WrappedEffectComposer,
  type EffectComposerProps
} from '@react-three/postprocessing'
import {
  NormalPass,
  type EffectComposer as EffectComposerImpl
} from 'postprocessing'
import { forwardRef, useLayoutEffect, useRef } from 'react'
import { mergeRefs } from 'react-merge-refs'
import { HalfFloatType, type WebGLRenderTarget } from 'three'
import invariant from 'tiny-invariant'

import { assertType } from '@takram/three-geospatial'

// Provided for half-float normal buffer.
export const EffectComposer = forwardRef<
  EffectComposerImpl,
  EffectComposerProps
>(function EffectComposer(props, forwardedRef) {
  const ref = useRef<EffectComposerImpl>(null)
  useLayoutEffect(() => {
    const composer = ref.current
    invariant(ref.current != null)
    const normalPass = composer?.passes.find(pass => pass instanceof NormalPass)
    invariant(normalPass != null)
    assertType<NormalPass & { renderTarget: WebGLRenderTarget }>(normalPass)
    normalPass.renderTarget.texture.type = HalfFloatType
  }, [])

  return (
    <WrappedEffectComposer
      ref={mergeRefs([ref, forwardedRef])}
      {...props}
      enableNormalPass
    />
  )
})
