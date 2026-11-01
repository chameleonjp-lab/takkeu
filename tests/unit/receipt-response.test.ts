import {expect,it} from 'vitest';
import {createRankingClient} from '../../src/ranking/client';
import {RANKING_CONFIG as config} from '../../src/ranking/config';
const startId='11111111-1111-4111-8111-111111111111',playId='22222222-2222-4222-8222-222222222222',submissionId='33333333-3333-4333-8333-333333333333';
const pending={play:{startId,playId,displayName:'A',normalizedName:'A'},submissionId,score:42,resultType:'game_over' as const,clientVersion:config.legacyClientVersion};
it('malformed or mismatched remote ACK remains retryable rather than permanently retiring the result',async()=>{for(const value of [{},{accepted:true,play_id:'bad'},{accepted:'true'}]){const c=createRankingClient(async()=>new Response(JSON.stringify(value)));await expect(c.start(startId,'A')).rejects.toMatchObject({retryable:true});await expect(c.finish(pending)).rejects.toMatchObject({retryable:true})}});
it('requires boolean flags in the exact 11-column receipt',async()=>{const ack={accepted:true,result_submission_id:submissionId,result_play_id:playId,result_normalized_name:'A',result_display_name:'A',result_first_score:42,result_best_score:42,result_play_count:1};const c=createRankingClient(async()=>new Response(JSON.stringify([ack])));await expect(c.submit(pending)).rejects.toMatchObject({retryable:true})});
it('local invalid identifiers remain permanent and do not send',async()=>{let calls=0;const c=createRankingClient(async()=>{calls++;return new Response('{}')});await expect(c.start('bad','A')).rejects.toMatchObject({retryable:false});expect(calls).toBe(0)});
