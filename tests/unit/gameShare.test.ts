import { describe, expect, it } from 'vitest';
import { GAME_CATALOG, gameSharePath } from '../../src/apps/games/gameCatalog';

describe('game share destinations',()=>{
 it('gives every game a distinct same-origin landing link without save data',()=>{
  const links=GAME_CATALOG.map(game=>new URL(gameSharePath(game.id),'https://nova.example'));
  expect(new Set(links.map(url=>url.href)).size).toBe(GAME_CATALOG.length);
  links.forEach((url,i)=>{
   expect(url.origin).toBe('https://nova.example');
   expect(url.pathname).toBe('/');
   expect([...url.searchParams.entries()]).toEqual([['game',GAME_CATALOG[i].id]]);
  });
 });
});
