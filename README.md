# IAS2
Pony green and story search using SPLADE neural network.

The indexer is in [this repository](https://github.com/a0346f102085fe9f/IndexerSPLADE).

Thanks go out to the authors of:
- [SPLADE v2](https://github.com/naver/splade)
- The pastebin scrape and poneb.in
- Fimfarchive, Fimfetch and Fimfiction itself

# Technical challenges: context length
SPLADE v2 network takes at most 512 tokens, but most stories tokenize into 30000+ tokens. For a document that is larger than 512 tokens, the network is given 512 tokens at a time and the resulting vectors are combined using a sum operation.

The network will never see the start and the end of the story within the same context.

# Technical challenges: query network
You are _supposed_ to run user queries through SPLADE v2 to expand them:

```
$ python3 argv_inference.py "snowpity"
{
    "elements": {
        "##pit": 3.13,
        "snow": 2.9,
        "##y": 1.85,
        "winter": 1.52,
        "storm": 0.62,
        "ruin": 0.43,
        ...
    },
    "magnitude": 5.087963104248047
}
```

I can't put SPLADE v2 into your browser and I don't have the option of running it on a backend somewhere. Instead, the thing imagines how the vector for your query is supposed to look like:

```
{
    "elements": {
        "snow": 1.0,
        "##pit": 1.0,
        "##y": 1.0
    },
    "magnitude": 1.7320508075688772 // sqrt(3.0)
}
```

This works well enough.
