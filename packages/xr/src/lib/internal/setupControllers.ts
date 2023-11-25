import type { XRTargetRaySpace } from 'three'
import { useThrelte } from '@threlte/core'
import { onMount } from 'svelte'
import { useHandTrackingState } from './useHandTrackingState'
import { createControllerModel } from './controllerModelFactory'
import type { XRControllerEvent } from '../types'
import { gaze, left, right } from '../hooks/useController'
import { controllerDispatchers } from './stores'

const events = [
  'connected',
  'disconnected',
  'select',
  'selectstart',
  'selectend',
  'squeeze',
  'squeezeend',
  'squeezestart'
] as const

const stores = { left, right, none: gaze } as const

export const setupControllers = () => {
  const { xr } = useThrelte().renderer
  const controller0 = xr.getController(0)
  const controller1 = xr.getController(1)
  const hasHands = useHandTrackingState()

  const indexMap = new Map()
  indexMap.set(controller0, 0)
  indexMap.set(controller1, 1)

  onMount(() => {
    const handleConnected = async (event: XRControllerEvent<'connected'>, index: number) => {
      const { data: inputSource } = event
      const targetRay = xr.getController(index)
      const grip = xr.getControllerGrip(index)

      stores[event.data.handedness].set({
        inputSource,
        targetRay,
        grip,
        model: inputSource.targetRayMode === 'tracked-pointer' && inputSource.gamepad !== undefined
          ? await createControllerModel(event)
          : undefined
      })
    }

    const handleDisconnected = (event: XRControllerEvent<'disconnected'>) => {
      stores[event.data.handedness].set(undefined)
    }

    function handleEvent (this: XRTargetRaySpace, event: XRControllerEvent) {
      const index = indexMap.get(this)
      if (event.type === 'connected') handleConnected(event as XRControllerEvent<'connected'>, index)
      if (event.type === 'disconnected') handleDisconnected(event as XRControllerEvent<'disconnected'>)
      if (!hasHands()) {
        const handedness = event.data.handedness as 'left' | 'right'
        controllerDispatchers[handedness]?.current?.(event.type, event)
      }
    }

    for (const name of events) {
      controller0.addEventListener(name, handleEvent as any)
      controller1.addEventListener(name, handleEvent as any)
    }
  
    return () => {
      for (const name of events) {
        controller0.removeEventListener(name, handleEvent as any)
        controller1.removeEventListener(name, handleEvent as any)
      }

      stores.left.set(undefined)
      stores.right.set(undefined)
      stores.none.set(undefined)
    }
  })
}
