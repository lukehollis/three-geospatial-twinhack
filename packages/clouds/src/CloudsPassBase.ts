import { Pass } from 'postprocessing'
import { Camera } from 'three'

import { type CascadedShadowMaps } from './CascadedShadowMaps'

export interface CloudsPassBaseOptions {
  shadow: CascadedShadowMaps
}

export abstract class CloudsPassBase extends Pass {
  shadow: CascadedShadowMaps

  private _mainCamera = new Camera()

  constructor(name: string, options: CloudsPassBaseOptions) {
    super(name)
    const { shadow } = options
    this.shadow = shadow
  }

  get mainCamera(): Camera {
    return this._mainCamera
  }

  set mainCamera(value: Camera) {
    this._mainCamera = value
  }
}
