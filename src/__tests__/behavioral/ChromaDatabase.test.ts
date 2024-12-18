import {
    CreateOptions,
    Database,
    databaseAssert,
    DatabaseInternalOptions,
    DataStoresError,
    Index,
    IndexWithFilter,
    QueryOptions,
    TestConnect,
} from '@sprucelabs/data-stores'
import { assertOptions, expandValues, flattenValues } from '@sprucelabs/schema'
import AbstractSpruceTest, {
    test,
    assert,
    errorAssert,
    generateId,
    NULL_PLACEHOLDER,
} from '@sprucelabs/test-utils'
import {
    ChromaClient,
    IncludeEnum,
    OllamaEmbeddingFunction,
    AddRecordsParams,
    CollectionMetadata,
    CollectionParams,
    DeleteParams,
    GetResponse,
    PeekParams,
    QueryRecordsParams,
    UpdateRecordsParams,
    UpsertRecordsParams,
    QueryResponse,
    ID,
    IDs,
    Where,
    WhereDocument,
    Metadatas,
} from 'chromadb'

export default class ChromaDatabaseTest extends AbstractSpruceTest {
    private static embedding: OllamaEmbeddingFunction
    private static db: Database
    private static collectionName: string
    private static chroma: ChromaClient
    private static collection: Collection

    protected static async beforeEach() {
        await super.beforeEach()

        this.chroma = new ChromaClient({ path: 'http://localhost:8000' })
        this.embedding = new OllamaEmbeddingFunction({
            model: 'llama3.2',
            url: 'http://localhost:11434/api/embeddings',
        })

        const { db } = await chromaConnect()

        this.db = db
        this.collectionName = generateId()

        this.collection = await this.chroma.getOrCreateCollection({
            name: this.collectionName,
            embeddingFunction: this.embedding,
        })
    }

    protected static async afterEach(): Promise<void> {
        await super.afterEach()
        try {
            await this.db.dropCollection(this.collectionName)
        } catch {}
    }

    @test()
    protected static async throwsWithMissing() {
        //@ts-ignore
        const err = assert.doesThrow(() => new ChromaDatabase())
        errorAssert.assertError(err, 'MISSING_PARAMETERS', {
            parameters: ['connectionString'],
        })
    }

    @test()
    protected static async defaultsToOllamaEmbedding() {
        await this.createOneAndAssertExpectedEmbeddings('name: Hello', {
            name: 'Hello',
        })
    }

    @test()
    protected static async embedsTheWholeDocumentByDefault() {
        await this.createOneAndAssertExpectedEmbeddings('test: true', {
            test: true,
        })
    }

    @test()
    protected static async canGenerateEmbedsForNestedValues() {
        await this.createOneAndAssertExpectedEmbeddings(
            `nested:\n\ttest: true`,
            {
                nested: { test: true },
            }
        )
    }

    @test()
    protected static async canDoMultipleKeyValuePairsForEmbeddings() {
        await this.createOneAndAssertExpectedEmbeddings(
            `name: Hello\ntest: true`,
            {
                name: 'Hello',
                test: true,
            }
        )
    }

    @test()
    protected static async canDoMultipleNestedKeyValuePairsForEmbeddings() {
        await this.createOneAndAssertExpectedEmbeddings(
            `nested:\n\ttest: true\nname: Hello`,
            {
                nested: { test: true },
                name: 'Hello',
            }
        )
    }

    @test.only()
    protected static async runsSuiteOfDatabaseTests() {
        await databaseAssert.runSuite(chromaConnect, [
            // '!assertThrowsWithBadDatabaseName',
            // '!assertCanSortDesc',
            // '!assertCanSortAsc',
            // '!assertCanSortById',
            // '!assertCanPushOntoArrayValue',
            'assertCanUpsertOne',
        ])
    }

    private static async createOneAndAssertExpectedEmbeddings(
        prompt: string,
        values: Record<string, any>
    ) {
        const expected = await this.generateEmbeddings([prompt])
        const created = await this.createOne(values)
        const match = await this.getById(created.id)

        assert.isEqual(
            match.documents?.[0],
            prompt,
            `The generate prompt did not match!`
        )
        assert.isEqualDeep(
            match.embeddings?.[0],
            expected[0],
            `The embeddings for ${JSON.stringify(values)} did not match based on the prompt '${prompt}'.`
        )
    }

    private static async getById(id: string) {
        return await this.collection.get({
            ids: [id],
            include: ['embeddings' as IncludeEnum, 'documents' as IncludeEnum],
        })
    }

    private static async generateEmbeddings(prompts: string[]) {
        return await this.embedding.generate(prompts)
    }

    private static async createOne(values: Record<string, any>) {
        return await this.db.createOne(this.collectionName, values)
    }
}

class ChromaDatabase implements Database {
    private connectionString: string
    private client!: ChromaClient
    private _isConnected = false
    private embeddings: OllamaEmbeddingFunction

    public constructor(connectionString: string) {
        assertOptions({ connectionString }, ['connectionString'])

        this.embeddings = new OllamaEmbeddingFunction({
            model: 'llama3.2',
            url: 'http://localhost:11434/api/embeddings',
        })

        if (!connectionString.startsWith('chroma://')) {
            throw new DataStoresError({
                code: 'INVALID_DB_CONNECTION_STRING',
            })
        }

        this.connectionString = connectionString.replace('chroma://', 'http://')
    }

    public async syncUniqueIndexes(
        collectionName: string,
        indexes: Index[]
    ): Promise<void> {
        debugger
    }
    public async syncIndexes(
        collectionName: string,
        indexes: Index[]
    ): Promise<void> {
        debugger
    }
    public async dropIndex(
        collectionName: string,
        index: Index
    ): Promise<void> {
        debugger
    }
    public async getUniqueIndexes(
        collectionName: string
    ): Promise<IndexWithFilter[]> {
        debugger
    }
    public async getIndexes(
        collectionName: string
    ): Promise<IndexWithFilter[]> {
        debugger
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
        options?: CreateOptions
    ): Promise<Record<string, any>> {
        const results = await this.create(collection, [values])
        return results[0]
    }

    private async getCollection(collection: string) {
        return await this.client.getOrCreateCollection({
            name: collection,
            embeddingFunction: this.embeddings,
        })
    }

    private buildPrompt(values: Record<string, any>) {
        let prompt = ''
        for (const key in values) {
            const value = values[key]
            if (typeof value === 'object') {
                prompt += `${key}:\n\t${this.buildPrompt(value)}\n`
            } else {
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
        const { documents, ids, metadatas } = this.splitValues(values)

        await col.add({
            documents,
            ids,
            metadatas,
        })

        return this.find(collection, { id: { $in: ids } })
    }

    private splitValues(values: Record<string, any>[]) {
        const ids = []
        const documents = []
        const metadatas: Metadatas = []

        for (const v of values) {
            const { id = this.generateId(), ...values } = v
            ids.push(id)
            documents.push(this.buildPrompt(values))
            const flattened = this.flattenValues(values)
            metadatas.push(flattened)
        }
        return { documents, ids, metadatas }
    }

    private flattenValues(values: Record<string, any>) {
        const flattened = flattenValues(values)
        for (const key in flattened) {
            if (flattened[key] === undefined) {
                flattened[key] = null
            }

            if (flattened[key] === null) {
                flattened[key] = NULL_PLACEHOLDER
            }
        }
        return flattened
    }

    public async dropCollection(name: string): Promise<void> {
        await this.client.deleteCollection({ name })
    }

    public async dropDatabase(): Promise<void> {
        const collections = await this.client.listCollections()
        await Promise.all(
            collections.map((col) => this.dropCollection(col.name))
        )
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
        let { ids, where } = this.buildQuery(query)

        const { limit } = options ?? {}
        const col = await this.getCollection(collection)
        const matches = await col.get({
            ids,
            include: ['metadatas' as IncludeEnum],
            where,
            limit,
        })
        const records: Record<string, any>[] = []
        for (let i = 0; i < matches.ids.length; i++) {
            const values = matches.metadatas[i] ?? {}
            records.push({
                id: matches.ids[i],
                ...this.expandValues(values),
            })
        }

        return records
    }

    private buildQuery(query?: Record<string, any> | undefined) {
        const { id, ...rest } = query ?? {}
        let ids: string[] | undefined
        let where: Where | undefined

        if (id?.$in) {
            ids = id.$in
        } else if (id) {
            ids = [id]
        } else if (query) {
            where = rest
        }

        //@ts-ignore
        if (where?.$or && where.$or.length === 1) {
            //@ts-ignore
            where = where.$or[0]
        }

        if (where) {
            const { $or, ...rest } = where
            where = this.flattenValues(rest)
            if ($or) {
                where.$or = $or
            }
        }
        return { ids, where }
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
        const { documents, metadatas } = this.splitValues([updates])

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

        debugger
        return updates
    }
    public async delete(
        collection: string,
        query: Record<string, any>
    ): Promise<number> {
        debugger
    }
    public async deleteOne(
        collection: string,
        query: Record<string, any>
    ): Promise<number> {
        debugger
    }
    public async count(
        collection: string,
        query?: Record<string, any>
    ): Promise<number> {
        const matches = await this.find(collection, query)
        return matches.length
    }
    public async createUniqueIndex(
        collection: string,
        index: Index
    ): Promise<void> {
        debugger
    }
    public async createIndex(collection: string, index: Index): Promise<void> {
        debugger
    }
    public async query<T>(query: string, params?: any[]): Promise<T[]> {
        debugger
    }
}

const chromaConnect: TestConnect = async (connectionString: string) => {
    const db = new ChromaDatabase(connectionString ?? 'chroma://localhost:8000')
    await db.connect()

    const badDatabaseName = generateId()

    return {
        db,
        scheme: 'chroma://',
        connectionStringWithRandomBadDatabaseName: `chroma://bad-database/${badDatabaseName}`,
        badDatabaseName,
    }
}

interface Collection {
    add(params: AddRecordsParams): Promise<void>
    /**
     * Upsert items to the collection
     * @param {Object} params - The parameters for the query.
     * @param {ID | IDs} [params.ids] - IDs of the items to add.
     * @param {Embedding | Embeddings} [params.embeddings] - Optional embeddings of the items to add.
     * @param {Metadata | Metadatas} [params.metadatas] - Optional metadata of the items to add.
     * @param {Document | Documents} [params.documents] - Optional documents of the items to add.
     * @returns {Promise<void>}
     *
     * @example
     * ```typescript
     * const response = await collection.upsert({
     *   ids: ["id1", "id2"],
     *   embeddings: [[1, 2, 3], [4, 5, 6]],
     *   metadatas: [{ "key": "value" }, { "key": "value" }],
     *   documents: ["document1", "document2"],
     * });
     * ```
     */
    upsert(params: UpsertRecordsParams): Promise<void>
    /**
     * Count the number of items in the collection
     * @returns {Promise<number>} - The number of items in the collection.
     *
     * @example
     * ```typescript
     * const count = await collection.count();
     * ```
     */
    count(): Promise<number>
    /**
     * Get items from the collection
     * @param {Object} params - The parameters for the query.
     * @param {ID | IDs} [params.ids] - Optional IDs of the items to get.
     * @param {Where} [params.where] - Optional where clause to filter items by.
     * @param {PositiveInteger} [params.limit] - Optional limit on the number of items to get.
     * @param {PositiveInteger} [params.offset] - Optional offset on the items to get.
     * @param {IncludeEnum[]} [params.include] - Optional list of items to include in the response.
     * @param {WhereDocument} [params.whereDocument] - Optional where clause to filter items by.
     * @returns {Promise<GetResponse>} - The response from the server.
     *
     * @example
     * ```typescript
     * const response = await collection.get({
     *   ids: ["id1", "id2"],
     *   where: { "key": "value" },
     *   limit: 10,
     *   offset: 0,
     *   include: ["embeddings", "metadatas", "documents"],
     *   whereDocument: { $contains: "value" },
     * });
     * ```
     */
    get({
        ids,
        where,
        limit,
        offset,
        include,
        whereDocument,
    }?: BaseGetParams): Promise<GetResponse>
    /**
     * Update items in the collection
     * @param {Object} params - The parameters for the query.
     * @param {ID | IDs} [params.ids] - IDs of the items to add.
     * @param {Embedding | Embeddings} [params.embeddings] - Optional embeddings of the items to add.
     * @param {Metadata | Metadatas} [params.metadatas] - Optional metadata of the items to add.
     * @param {Document | Documents} [params.documents] - Optional documents of the items to add.
     * @returns {Promise<void>}
     *
     * @example
     * ```typescript
     * const response = await collection.update({
     *   ids: ["id1", "id2"],
     *   embeddings: [[1, 2, 3], [4, 5, 6]],
     *   metadatas: [{ "key": "value" }, { "key": "value" }],
     *   documents: ["document1", "document2"],
     * });
     * ```
     */
    update(params: UpdateRecordsParams): Promise<void>
    /**
     * Performs a query on the collection using the specified parameters.
     *
     * @param {Object} params - The parameters for the query.
     * @param {Embedding | Embeddings} [params.queryEmbeddings] - Optional query embeddings to use for the search.
     * @param {PositiveInteger} [params.nResults] - Optional number of results to return (default is 10).
     * @param {Where} [params.where] - Optional query condition to filter results based on metadata values.
     * @param {string | string[]} [params.queryTexts] - Optional query text(s) to search for in the collection.
     * @param {WhereDocument} [params.whereDocument] - Optional query condition to filter results based on document content.
     * @param {IncludeEnum[]} [params.include] - Optional array of fields to include in the result, such as "metadata" and "document".
     *
     * @returns {Promise<QueryResponse>} A promise that resolves to the query results.
     * @throws {Error} If there is an issue executing the query.
     * @example
     * // Query the collection using embeddings
     * const results = await collection.query({
     *   queryEmbeddings: [[0.1, 0.2, ...], ...],
     *   nResults: 10,
     *   where: {"name": {"$eq": "John Doe"}},
     *   include: ["metadata", "document"]
     * });
     * @example
     * ```js
     * // Query the collection using query text
     * const results = await collection.query({
     *   queryTexts: "some text",
     *   nResults: 10,
     *   where: {"name": {"$eq": "John Doe"}},
     *   include: ["metadata", "document"]
     * });
     * ```
     *
     */
    query({
        nResults,
        where,
        whereDocument,
        include,
        queryTexts,
        queryEmbeddings,
    }: QueryRecordsParams): Promise<QueryResponse>
    /**
     * Modify the collection name or metadata
     * @param {Object} params - The parameters for the query.
     * @param {string} [params.name] - Optional new name for the collection.
     * @param {CollectionMetadata} [params.metadata] - Optional new metadata for the collection.
     * @returns {Promise<void>} - The response from the API.
     *
     * @example
     * ```typescript
     * const response = await client.updateCollection({
     *   name: "new name",
     *   metadata: { "key": "value" },
     * });
     * ```
     */
    modify({
        name,
        metadata,
    }: {
        name?: string
        metadata?: CollectionMetadata
    }): Promise<CollectionParams>
    /**
     * Peek inside the collection
     * @param {Object} params - The parameters for the query.
     * @param {PositiveInteger} [params.limit] - Optional number of results to return (default is 10).
     * @returns {Promise<GetResponse>} A promise that resolves to the query results.
     * @throws {Error} If there is an issue executing the query.
     *
     * @example
     * ```typescript
     * const results = await collection.peek({
     *   limit: 10
     * });
     * ```
     */
    peek({ limit }?: PeekParams): Promise<GetResponse>
    /**
     * Deletes items from the collection.
     * @param {Object} params - The parameters for deleting items from the collection.
     * @param {ID | IDs} [params.ids] - Optional ID or array of IDs of items to delete.
     * @param {Where} [params.where] - Optional query condition to filter items to delete based on metadata values.
     * @param {WhereDocument} [params.whereDocument] - Optional query condition to filter items to delete based on document content.
     * @returns {Promise<string[]>} A promise that resolves to the IDs of the deleted items.
     * @throws {Error} If there is an issue deleting items from the collection.
     *
     * @example
     * ```typescript
     * const results = await collection.delete({
     *   ids: "some_id",
     *   where: {"name": {"$eq": "John Doe"}},
     *   whereDocument: {"$contains":"search_string"}
     * });
     * ```
     */
    delete(options?: DeleteParams): Promise<void>
}

interface BaseGetParams {
    ids?: ID | IDs
    where?: Where
    limit?: number
    offset?: number
    include?: IncludeEnum[]
    whereDocument?: WhereDocument
}
