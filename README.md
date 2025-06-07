# Chroma Data Store

Give your skill the ability to store and retrieve data from a Chroma database.

## Running the Chroma Database

1. Clone this rep
2. Run `yarn start.chroma.docker`

## Setting an embedding model

By default, the ChromaDabatase class will use llama3.2 hosted through Ollama to generate embeddings

### Installing Ollama

1. Visit https://ollama.com
2. Click "Download"
3. Select your OS

### Installing Llama3.2

Llama 3.2 is the newest version of Llama (as of this writing) that supports embeddings.

1. Inside of terminal, run `ollama run llama3.2`
2. You should be able to visit http://localhost:11434/api/embeddings and get a 405 response (this is because the route only accepts POST requests)

### Improving embeddings with `nomic-embed-text`

We have seen significantly better search performance when using `nomic-embed-text` to generate embeddings.

Run `ollama pull nomic-embed-text`


## Using in your skill

Add the following to your env:

```bash
DB_CONNECTION_STRING="chromadb://localhost:8000"
DB_ADAPTER="@sprucelabs/chroma-data-store"

```
