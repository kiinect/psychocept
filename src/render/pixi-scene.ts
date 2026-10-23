import { BitmapFont, BitmapText, Container, Sprite, Texture } from 'pixi.js';
import type { Atlas } from '../art';
import { SceneAdapter, type Visual } from './scene';

/** Atlas sprites share one source and normal blend mode, keeping the containers batchable. */
export function createSpriteScene(atlas: Atlas) {
  const container = new Container();
  const layers = Array.from({ length: 5 }, () => new Container());
  container.addChild(...layers);
  BitmapFont.install({ name: 'SceneNumbers', style: { fontFamily: 'Arial', fontSize: 18, fontWeight: 'bold', fill: '#fff19b', stroke: { color: '#233328', width: 3 } }, chars: '0123456789+$' });
  const adapter = new SceneAdapter((text, layer) => {
    const visual = text ? new BitmapText({ text: '', style: { fontFamily: 'SceneNumbers', fontSize: 18 } }) : new Sprite(Texture.EMPTY);
    visual.anchor.set(0.5); visual.visible = false;
    layers[layer].addChild(visual);
    return visual as unknown as Visual;
  }, key => {
    const texture = atlas[key];
    if (!texture) throw new Error(`Missing scene texture: ${key}`);
    return texture;
  });
  return { container, adapter };
}
