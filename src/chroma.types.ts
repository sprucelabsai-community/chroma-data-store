import { IncludeEnum, Metadata } from 'chromadb'

export type ID = string
export type Embedding = number[]
export type Embeddings = Embedding[]
export interface GetResponse {
    ids: ID[]
    embeddings: Embeddings | null
    documents: (Document | null)[]
    metadatas: (Metadata | null)[]
    included: IncludeEnum[]
}

export type WhereWithPrompt = WhereDocument & {
    $prompt?: string
}

export interface WhereDocument {
    $contains?: string
    $not_contains?: string
    $matches?: string
    $not_matches?: string
    $regex?: string
    $not_regex?: string
    $and?: WhereDocument[]
    $or?: WhereDocument[]
}
