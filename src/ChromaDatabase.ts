import {
    CreateOptions,
    Database,
    DatabaseInternalOptions,
    DataStoresError,
    generateId,
    Index,
    IndexWithFilter,
    QueryOptions,
} from '@sprucelabs/data-stores'
import { assertOptions, flattenValues, expandValues } from '@sprucelabs/schema'
import { NULL_PLACEHOLDER } from '@sprucelabs/test-utils'
import {
    ChromaClient,
    OllamaEmbeddingFunction,
    Metadatas,
    IncludeEnum,
    Where,
    GetResponse,
    IDs,
    Metadata,
} from 'chromadb'
import { Collection, WhereWithPrompt } from './chroma.types'
import SpruceError from './errors/SpruceError'

export default class ChromaDatabase implements Database {
    public static Class?: new (connectionString: string) => Database
    public static EmbeddingFunction = OllamaEmbeddingFunction

    private static embeddingFields?: Record<string, string[]>

    private connectionString: string
    private client!: ChromaClient
    private _isConnected = false
    private embeddings: OllamaEmbeddingFunction
    private collections: Record<string, Collection> = {}

    public constructor(connectionString: string) {
        assertOptions({ connectionString }, ['connectionString'])

        this.embeddings = new ChromaDatabase.EmbeddingFunction({
            model: process.env.CHROMA_EMBEDDING_MODEL ?? 'llama3.2',
            url: 'http://localhost:11434/api/embeddings',
        })

        if (!connectionString.startsWith('chroma://')) {
            throw new DataStoresError({
                code: 'INVALID_DB_CONNECTION_STRING',
            })
        }

        this.connectionString = connectionString.replace('chroma://', 'http://')
    }

    public static Database(connectionString: string) {
        return new (this.Class ?? this)(connectionString)
    }

    public static setEmbeddingsFields(
        collectionName: string,
        fields: string[]
    ) {
        if (!this.embeddingFields) {
            this.embeddingFields = {}
        }
        this.embeddingFields[collectionName] = fields
    }

    public static clearEmbeddingsFields() {
        delete this.embeddingFields
    }

    public static getEmbeddingsFields() {
        return this.embeddingFields
    }

    public async syncUniqueIndexes(
        _collectionName: string,
        _indexes: Index[]
    ): Promise<void> {
        throw new SpruceError({
            code: 'FEATURE_NOT_SUPPORTED',
            operation: 'syncUniqueIndexes',
        })
    }

    public async syncIndexes(
        _collectionName: string,
        _indexes: Index[]
    ): Promise<void> {
        throw new SpruceError({
            code: 'FEATURE_NOT_SUPPORTED',
            operation: 'syncIndexes',
        })
    }

    public async dropIndex(
        _collectionName: string,
        _index: Index
    ): Promise<void> {
        throw new SpruceError({
            code: 'FEATURE_NOT_SUPPORTED',
            operation: 'dropIndex',
        })
    }

    public async getUniqueIndexes(
        _collectionName: string
    ): Promise<IndexWithFilter[]> {
        throw new SpruceError({
            code: 'FEATURE_NOT_SUPPORTED',
            operation: 'getUniqueIndexes',
        })
    }

    public async getIndexes(
        _collectionName: string
    ): Promise<IndexWithFilter[]> {
        throw new SpruceError({
            code: 'FEATURE_NOT_SUPPORTED',
            operation: 'getIndexes',
        })
    }

    public isConnected(): boolean {
        return this._isConnected
    }

    public generateId(): string {
        return generateId()
    }

    public async connect(): Promise<void> {
        this.client = new ChromaClient({ path: this.connectionString })
        try {
            await this.client.heartbeat()
        } catch (err: any) {
            throw new DataStoresError({
                code: 'UNABLE_TO_CONNECT_TO_DB',
                originalError: err,
            })
        }
        this._isConnected = true
    }

    public async close(): Promise<void> {
        this._isConnected = false
    }

    public getShouldAutoGenerateId?(): boolean {
        return true
    }

    public async createOne(
        collection: string,
        values: Record<string, any>,
        _options?: CreateOptions
    ): Promise<Record<string, any>> {
        const results = await this.create(collection, [values])
        return results[0]
    }

    private async getCollection(collection: string) {
        if (!this.collections[collection]) {
            this.collections[collection] =
                await this.client.getOrCreateCollection({
                    name: collection,
                    embeddingFunction: this.embeddings,
                })
        }

        return this.collections[collection]
    }

    private buildPrompt(values: Record<string, any>, collectionName: string) {
        const fields = ChromaDatabase.embeddingFields?.[collectionName]
        if (fields?.length === 1) {
            const field = fields[0]
            return values[field]
        }
        let prompt = ''
        const keys = Object.keys(values)
        for (const key of keys) {
            const value = values[key]
            if (value && typeof value === 'object') {
                prompt += `${key}:\n\t${this.buildPrompt(value, collectionName)}\n`
            } else if (value) {
                prompt += `${key}: ${value}\n`
            }
        }
        return prompt.trim()
    }

    public async create(
        collection: string,
        values: Record<string, any>[]
    ): Promise<Record<string, any>[]> {
        const col = await this.getCollection(collection)
        const { documents, ids, metadatas } = this.splitValues(
            values,
            collection
        )

        await col.add({
            documents,
            ids,
            metadatas,
        })

        return this.find(collection, { id: { $in: ids } })
    }

    private splitValues(values: Record<string, any>[], collectionName: string) {
        const ids = []
        const documents = []
        const metadatas: Metadatas = []

        for (const v of values) {
            const { id = this.generateId(), ...values } = v
            ids.push(id)
            documents.push(this.buildPrompt(values, collectionName))
            const flattened = this.flattenValues(values)
            metadatas.push(flattened)
        }
        return { documents, ids, metadatas }
    }

    private flattenValues(values: Record<string, any>) {
        const flattened = flattenValues(values, [
            '$or',
            '*.$gt',
            '*.$gte',
            '*.$lt',
            '*.$lte',
            '*.$ne',
        ])
        this.dropInNullPlaceholders(flattened)
        return flattened
    }

    private dropInNullPlaceholders(flattened: Record<string, any>) {
        for (const key in flattened) {
            if (flattened[key] === undefined) {
                flattened[key] = null
            }

            if (flattened[key] === null) {
                flattened[key] = NULL_PLACEHOLDER
            }

            if (typeof flattened[key] === 'object') {
                this.dropInNullPlaceholders(flattened[key])
            }
        }
    }

    public async dropCollection(name: string): Promise<void> {
        await this.client.deleteCollection({ name })
    }

    public async dropDatabase(): Promise<void> {
        const collections = await this.client.listCollections()
        await Promise.all(collections.map((col) => this.dropCollection(col)))
    }

    public async findOne(
        collection: string,
        query?: Record<string, any>,
        options?: QueryOptions,
        dbOptions?: DatabaseInternalOptions
    ): Promise<Record<string, any> | null> {
        const matches = await this.find(
            collection,
            query,
            { ...options, limit: 1 },
            dbOptions
        )
        return matches[0] ?? null
    }

    public async find(
        collection: string,
        query?: Record<string, any>,
        options?: QueryOptions,
        _dbOptions?: DatabaseInternalOptions
    ): Promise<Record<string, any>[]> {
        let { ids, where, skipIds } = this.buildQuery(query)
        let matches: Pick<GetResponse, 'ids' | 'metadatas'> | undefined

        let { limit, includeFields } = options ?? {}
        const col = await this.getCollection(collection)

        if (!limit && where?.$prompt) {
            limit = 10
        }

        if (where?.$prompt) {
            const { $prompt, ...rest } = where
            const queryResults = await col.query({
                queryTexts: [$prompt],
                nResults: limit,
                where: Object.keys(rest).length > 0 ? rest : undefined,
            })

            matches = {
                ids: queryResults.ids[0] as IDs,
                metadatas: queryResults.metadatas[0] as (Metadata | null)[],
            }
        } else {
            matches = await col.get({
                ids,
                include: ['metadatas' as IncludeEnum],
                where,
                limit: limit == 0 ? 1 : limit,
            })
        }

        if (!matches || !matches.ids[0]) {
            return []
        }

        let records: Record<string, any>[] = this.mapResultsToRecords(
            limit,
            matches,
            skipIds
        )

        if (includeFields) {
            records = this.filterFieldsByInclude(records, includeFields)
        }

        return records
    }

    private mapResultsToRecords(
        limit: number | undefined,
        matches: Pick<GetResponse, 'ids' | 'metadatas'>,
        skipIds: string[]
    ) {
        let records: Record<string, any>[] = []
        const total = limit ?? matches.ids.length
        for (let i = 0; i < total; i++) {
            const values = matches.metadatas[i] ?? {}
            const id = matches.ids[i]
            if (!skipIds.includes(id)) {
                records.push({
                    id,
                    ...this.expandValues(values),
                })
            }
        }
        return records
    }

    private filterFieldsByInclude(
        records: Record<string, any>[],
        includeFields: string[]
    ) {
        const trimmedRecords: Record<string, any>[] = []
        // eslint-disable-next-line @typescript-eslint/prefer-for-of
        for (let c = 0; c < records.length; c++) {
            const record: Record<string, any> = {}
            for (const key of includeFields) {
                record[key] = records[c][key]
            }
            trimmedRecords.push(record)
        }
        return trimmedRecords
    }

    private buildQuery(query?: Record<string, any> | undefined) {
        const { id, ...rest } = query ?? {}
        let ids: string[] | undefined
        let where: WhereWithPrompt | undefined

        if (id?.$in) {
            ids = id.$in
        } else if (id) {
            ids = [id]
        } else if (query) {
            where = rest
        }

        if (where?.$or && (where.$or as Where[]).length === 1) {
            //@ts-ignore
            where = where.$or[0]
        }

        if (where) {
            const { $or, $prompt, ...rest } = where
            if ($or) {
                where.$or = $or
            } else {
                where = this.flattenValues(rest)
                if (Object.keys(where).length > 1) {
                    const $and = []
                    for (const key in where) {
                        //@ts-ignore
                        $and.push({ [key]: where[key] })
                    }
                    where = {
                        $and,
                    }
                }
            }
            if ($prompt) {
                where.$prompt = $prompt
            }
        }

        const firstId = ids?.[0]
        const skipIds: string[] = []
        //@ts-ignore
        if (firstId?.['$ne']) {
            //@ts-ignore
            skipIds.push(firstId.$ne)
            ids = undefined
        }

        if (Object.keys(where ?? {}).length === 0) {
            where = undefined
        }

        return { ids, where, skipIds }
    }

    private expandValues(values: Record<string, any>): Record<string, any> {
        const nulledValues: Record<string, any> = {}
        for (const key in values) {
            if (values[key] === NULL_PLACEHOLDER) {
                nulledValues[key] = null
            } else {
                nulledValues[key] = values[key]
            }
        }
        return expandValues(nulledValues)
    }

    public async updateOne(
        collection: string,
        query: Record<string, any>,
        updates: Record<string, any>,
        _dbOptions?: DatabaseInternalOptions
    ): Promise<Record<string, any>> {
        const col = await this.getCollection(collection)
        const match = await this.findOne(collection, query)

        if (!match) {
            throw new DataStoresError({
                code: 'RECORD_NOT_FOUND',
                query,
                storeName: collection,
            })
        }
        const { documents, metadatas } = this.splitValues([updates], collection)

        await col.update({
            ids: [match.id],
            documents,
            metadatas,
        })

        const { id, ...values } = match

        return { id, ...values, ...updates }
    }

    public async update(
        collection: string,
        query: Record<string, any>,
        updates: Record<string, any>
    ): Promise<number> {
        const matches = await this.find(collection, query)
        for (const match of matches) {
            await this.updateOne(collection, { id: match.id }, updates)
        }
        return matches.length
    }

    public async upsertOne(
        collection: string,
        query: Record<string, any>,
        updates: Record<string, any>
    ): Promise<Record<string, any>> {
        const col = await this.getCollection(collection)
        const match = await this.findOne(collection, query)
        let { documents, ids, metadatas } = this.splitValues(
            [updates],
            collection
        )

        if (match?.id) {
            ids = [match.id]
        }

        await col.upsert({
            documents,
            ids,
            metadatas,
        })

        const updated = await this.findOne(collection, { id: ids[0] })

        return updated!
    }

    public async delete(
        collection: string,
        query: Record<string, any>
    ): Promise<number> {
        const matches = await this.find(collection, query)
        if (matches.length === 0) {
            return 0
        }
        const col = await this.getCollection(collection)
        await col.delete({
            ids: matches.map((m) => m.id),
        })
        return matches.length
    }

    public async deleteOne(
        collection: string,
        query: Record<string, any>
    ): Promise<number> {
        const match = await this.findOne(collection, query)
        await this.delete(collection, { id: match?.id })
        return match ? 1 : 0
    }

    public async count(
        collection: string,
        query?: Record<string, any>
    ): Promise<number> {
        const matches = await this.find(collection, query)
        return matches.length
    }

    public async createUniqueIndex(
        _collection: string,
        _index: Index
    ): Promise<void> {
        throw new SpruceError({
            code: 'FEATURE_NOT_SUPPORTED',
            operation: 'createUniqueIndex',
        })
    }

    public async createIndex(
        _collection: string,
        _index: Index
    ): Promise<void> {
        throw new SpruceError({
            code: 'FEATURE_NOT_SUPPORTED',
            operation: 'createIndex',
        })
    }

    public async query<T>(_query: string, _params?: any[]): Promise<T[]> {
        throw new SpruceError({
            code: 'FEATURE_NOT_SUPPORTED',
            operation: 'query',
        })
    }
}
