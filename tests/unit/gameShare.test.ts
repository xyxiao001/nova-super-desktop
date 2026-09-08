import { afterEach, describe, expect, it, vi } from 'vitest';
import { GAME_CATALOG, gameSharePath } from '../../src/apps/games/gameCatalog';
import { copyGameShareLink } from '../../src/apps/games/entry';

afterEach(()=>vi.unstubAllGlobals());

describe('game share destinations',()=>{
 it('uses manual sharing when the clipboard API is unavailable',async()=>{
  vi.stubGlobal('navigator',{});
  expect(await copyGameShareLink('http://100.82.233.127:3000/?game=frontline')).toBe('manual');
 });
 it('reports copied only after the existing clipboard operation completes',async()=>{
  const writeText=vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal('navigator',{clipboard:{writeText}});
  const url='https://nova.example/?game=frontline';
  expect(await copyGameShareLink(url)).toBe('copied');
  expect(writeText).toHaveBeenCalledExactlyOnceWith(url);
 });
 it('preserves rejection from an available clipboard API',async()=>{
  const error=new Error('Permission denied');
  vi.stubGlobal('navigator',{clipboard:{writeText:vi.fn().mockRejectedValue(error)}});
  await expect(copyGameShareLink('https://nova.example/?game=frontline')).rejects.toBe(error);
 });
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
