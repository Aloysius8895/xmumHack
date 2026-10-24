/** Fetch new observations; reloading existing state is only the final step. */
export async function collectNewSample(api,{onChange=()=>{},pause=ms=>new Promise(resolve=>setTimeout(resolve,ms)),maxPolls=250}={})
{
    let run=await api.startMarketSample()
    onChange(run)
    for(let attempt=0;attempt<maxPolls;attempt++)
    {
        if(run.status==='published'){await api.refresh();return run}
        if(run.status==='failed')throw Object.assign(new Error(run.error),{code:run.error??'crawler-collection-failed'})
        await pause(3000)
        run=await api.marketSampleStatus(run.runId)
        onChange(run)
    }
    throw Object.assign(new Error('Collection is still running'),{code:'crawler-refresh-timeout'})
}
