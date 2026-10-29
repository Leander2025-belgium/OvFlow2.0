import {afterEach,describe,expect,it,vi} from 'vitest';import {z} from 'zod';
vi.mock('idb-keyval',()=>({get:vi.fn(),set:vi.fn()}));
import {get} from 'idb-keyval';import {cachedRequest} from '../src/data/irail';
afterEach(()=>{vi.unstubAllGlobals();vi.clearAllMocks();});
describe('offline snapshot safety',()=>{
 it('reads an old board immediately and labels it offline',async()=>{vi.stubGlobal('navigator',{onLine:false});const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);vi.mocked(get).mockResolvedValue({value:{value:1},storedAt:0});const result=await cachedRequest('liveboard',{},z.object({value:z.number()}));expect(result.offline).toBe(true);expect(fetcher).not.toHaveBeenCalled();});
 it('never offers a cached route as a new offline route',async()=>{vi.stubGlobal('navigator',{onLine:false});vi.mocked(get).mockResolvedValue({value:{value:1},storedAt:Date.now()});await expect(cachedRequest('connections',{},z.object({value:z.number()}))).rejects.toThrow('offline');});
 it('honors canceled requests even if a cached snapshot exists',async()=>{vi.stubGlobal('navigator',{onLine:false});vi.mocked(get).mockResolvedValue({value:{value:1},storedAt:0});const controller=new AbortController();controller.abort();await expect(cachedRequest('liveboard',{},z.object({value:z.number()}),controller.signal)).rejects.toMatchObject({name:'AbortError'});});
});
