import { Database, databaseAssert, TestConnect } from '@sprucelabs/data-stores'
import AbstractSpruceTest, {
    test,
    assert,
    errorAssert,
    generateId,
    suite,
} from '@sprucelabs/test-utils'
import { OllamaEmbeddingFunction } from '@chroma-core/ollama'
import { ChromaClient, Collection, IncludeEnum } from 'chromadb'
import ChromaDatabase from '../../ChromaDatabase'

@suite()
export default class ChromaDatabaseTest extends AbstractSpruceTest {
    private embedding = new OllamaEmbeddingFunction({
        model: 'llama3.2',
        url: 'http://localhost:11434',
    })
    private db!: Database
    private collectionName!: string
    private chroma = new ChromaClient({ path: 'http://localhost:8000' })
    private collection!: Collection

    protected async beforeEach() {
        await super.beforeEach()

        ChromaDatabase.clearEmbeddingsFields()

        const { db } = await chromaConnect()

        this.db = db
        this.collectionName = generateId()
        this.collection = await this.getOrCreateCollection()
    }

    protected async afterEach(): Promise<void> {
        await super.afterEach()
        try {
            await this.db.dropCollection(this.collectionName)
        } catch {}
    }

    @test()
    protected async throwsWithMissing() {
        //@ts-ignore
        const err = assert.doesThrow(() => new ChromaDatabase())
        errorAssert.assertError(err, 'MISSING_PARAMETERS', {
            parameters: ['connectionString'],
        })
    }

    @test()
    protected async defaultsToOllamaEmbedding() {
        await this.createOneAndAssertExpectedEmbeddings('name: Hello', {
            name: 'Hello',
        })
    }

    @test()
    protected async embedsTheWholeDocumentByDefault() {
        await this.createOneAndAssertExpectedEmbeddings('test: true', {
            test: true,
        })
    }

    @test()
    protected async canGenerateEmbedsForNestedValues() {
        await this.createOneAndAssertExpectedEmbeddings(
            `nested:\n\ttest: true`,
            {
                nested: { test: true },
            }
        )
    }

    @test()
    protected async canDoMultipleKeyValuePairsForEmbeddings() {
        await this.createOneAndAssertExpectedEmbeddings(
            `name: Hello\ntest: true`,
            {
                name: 'Hello',
                test: true,
            }
        )
    }

    @test()
    protected async canDoMultipleNestedKeyValuePairsForEmbeddings() {
        await this.createOneAndAssertExpectedEmbeddings(
            `nested:\n\ttest: true\nname: Hello`,
            {
                nested: { test: true },
                name: 'Hello',
            }
        )
    }

    @test()
    protected async throwsExpectedErrorForUnsupportedFeatures() {
        await this.assertOperationThrowsNotSupported(
            () => this.db.syncIndexes(generateId(), []),
            'syncIndexes'
        )

        await this.assertOperationThrowsNotSupported(
            () => this.db.dropIndex(generateId(), []),
            'dropIndex'
        )

        await this.assertOperationThrowsNotSupported(
            () => this.db.getUniqueIndexes(generateId()),
            'getUniqueIndexes'
        )

        await this.assertOperationThrowsNotSupported(
            () => this.db.getIndexes(generateId()),
            'getIndexes'
        )

        await this.assertOperationThrowsNotSupported(
            () => this.db.query(''),
            'query'
        )

        await this.assertOperationThrowsNotSupported(
            () => this.db.createUniqueIndex('', []),
            'createUniqueIndex'
        )

        await this.assertOperationThrowsNotSupported(
            () => this.db.createIndex('', []),
            'createIndex'
        )

        await this.assertOperationThrowsNotSupported(
            () => this.db.syncUniqueIndexes('', []),
            'syncUniqueIndexes'
        )
    }

    @test()
    protected async runsSuiteOfDatabaseTests() {
        await databaseAssert.runSuite(chromaConnect, [
            '!assertThrowsWithBadDatabaseName',
            '!assertCanSortDesc',
            '!assertCanSortAsc',
            '!assertCanSortById',
            '!assertCanPushOntoArrayValue',
            '!assertCanPushToArrayOnUpsert',
            '!assertCanSyncUniqueIndexesWithFilterExpression',
            '!assertCanSearchByRegex',
            '!assertHasNoUniqueIndexToStart',
            '!assertCanCreateUniqueIndex',
            '!assertCanCreateMultiFieldUniqueIndex',
            '!assertCantCreateUniqueIndexTwice',
            '!assertCanDropUniqueIndex',
            '!assertCanDropCompoundUniqueIndex',
            '!assertCantDropUniqueIndexThatDoesntExist',
            '!assertCantDropIndexWhenNoIndexExists',
            '!assertCantDropCompoundUniqueIndexThatDoesntExist',
            '!assertSyncingUniqueIndexesAddsMissingIndexes',
            '!assertSyncingUniqueIndexesSkipsExistingUniqueIndexes',
            '!assertSyncingUniqueIndexesRemovesExtraUniqueIndexes',
            '!assertUniqueIndexBlocksDuplicates',
            '!assertDuplicateKeyThrowsOnInsert',
            '!assertSettingUniqueIndexViolationThrowsSpruceError',
            '!assertCanCreateUniqueIndexOnNestedField',
            '!assertHasNoIndexToStart',
            '!assertCanCreateIndex',
            '!assertCantCreateSameIndexTwice',
            '!assertCanCreateMultiFieldIndex',
            '!assertCanDropIndex',
            '!assertCanDropCompoundIndex',
            '!assertCantDropCompoundIndexThatDoesNotExist',
            '!assertSyncIndexesSkipsExisting',
            '!assertSyncIndexesRemovesExtraIndexes',
            '!assertSyncIndexesHandlesRaceConditions',
            '!assertSyncIndexesDoesNotRemoveExisting',
            '!assertDuplicateFieldsWithMultipleUniqueIndexesWorkAsExpected',
            '!assertCanSyncIndexesWithoutPartialThenAgainWithProperlyUpdates',
            '!assertCanHaveUniqueIndexOnFieldThatIsAlreadyInIndex',
            '!assertSyncUniqueIndexesSkipsOnesThatExist',
            '!assertNestedFieldIndexUpdates',
            '!assertSyncingUniqueIndexesIsRaceProof',
            '!assertUpsertWithUniqueIndex',
        ])
    }

    @test()
    protected async canSetSingleEmbeddingField() {
        await this.setEmbedFieldsAndAssertEmbeddingsEqual(['name'], 'Hello', {
            name: 'Hello',
            test: true,
        })
    }

    @test()
    protected async canSetDifferentSingleEmbeddingField() {
        await this.setEmbedFieldsAndAssertEmbeddingsEqual(
            ['firstName'],
            'Cheese',
            {
                firstName: 'Cheese',
                name: 'Hello',
                test: false,
            }
        )
    }

    @test()
    protected async canSetMultipleFieldsOnEmbedding() {
        await this.setEmbedFieldsAndAssertEmbeddingsEqual(
            ['firstName', 'lastName'],
            'firstName: tay\nlastName: ro',
            {
                firstName: 'tay',
                lastName: 'ro',
            }
        )
    }

    @test()
    protected async embeddingFieldsHonorsCollection() {
        this.setEmbeddingFields(['lastName'])
        this.setEmbeddingFields(['name'], generateId())

        await this.assertEmbeddingsEqual(
            {
                lastName: 'test',
            },
            'test'
        )
    }

    @test()
    protected async dropDatabaseDeletesAllCollections() {
        await this.getOrCreateCollection(generateId())
        await this.getOrCreateCollection(generateId())
        await this.getOrCreateCollection(generateId())
        await this.db.dropDatabase()

        const client = new ChromaClient({ path: 'http://localhost:8000' })
        const collections = await client.listCollections()
        assert.isLength(collections, 0, 'Collections were not deleted')
    }

    @test()
    protected async doesTextSearchWith$promptKey() {
        const created = await this.createSearchableDocuments()
        const results = await this.findByPrompt('down')

        assert.isEqualDeep(
            results[0],
            created[1],
            'Searching based on $prompt did not return the expected match'
        )
    }

    @test()
    protected async canFindUsingDifferent$promptKey() {
        const created = await this.createSearchableDocuments()
        const results = await this.findByPrompt('pepper')

        assert.isEqualDeep(
            results[0],
            created[0],
            'Searching based on $prompt did not return the expected match'
        )
    }

    @test()
    protected async canFindUsingDifferentLimit() {
        await this.createSearchableDocuments()
        const results = await this.findByPrompt('pepper', 2)
        assert.isLength(results, 2, 'Expected to find two results')
    }

    @test()
    protected async canSearchByPromptAndDocumentFields() {
        const created = await this.createSearchableDocuments()
        const results = await this.findByPrompt('cheese', 1, { hello: 'world' })
        const expected = created[3]
        assert.isEqualDeep(
            results[0],
            expected,
            'Searching based on $prompt and document fields did not return the expected match'
        )
    }

    @test()
    protected async canSearchSamePromptAndDifferentDocumentFields() {
        const created = await this.createSearchableDocuments()
        const results = await this.findByPrompt('cheese', 1, { world: 'hello' })
        const expected = created[4]
        assert.isEqualDeep(
            results[0],
            expected,
            'Searching based on $prompt and document fields did not return the expected match'
        )
    }

    @test()
    protected async searchingByPromptReturns10ByDefault() {
        await this.createSearchableDocuments('stardust')
        const results = await this.db.find(this.collectionName, {
            $prompt: 'stardust',
        })
        assert.isLength(results, 10, 'Expected to find 10 results')
    }

    @test()
    protected async searchingByPromptHonorsLimit() {
        await this.createSearchableDocuments('stardust')
        const results = await this.findByPrompt('stardust', 5)
        assert.isLength(results, 5, 'Expected to find 5 results')
    }

    @test()
    protected async deletingDocumentsWhereThereAreNoMatchesDoesNotThrow() {
        await this.createSearchableDocuments('toasty')
        const query = { code: 'toasty' }
        await this.delete(query)
        const totalDeleted = await this.delete(query)
        assert.isEqual(totalDeleted, 0, 'Expected to delete 0 documents')
    }

    @test()
    protected async canOverrideTheModelUsingEnv() {
        process.env.CHROMA_EMBEDDING_MODEL = generateId()
        ChromaDatabase.EmbeddingFunction = SpyOllamaEmbeddingFunction
        await chromaConnect()
        assert.isEqual(
            SpyOllamaEmbeddingFunction.instance?.constructorOptions?.model,
            process.env.CHROMA_EMBEDDING_MODEL
        )
    }

    private async delete(query: Record<string, any>) {
        return await this.db.delete(this.collectionName, query)
    }

    private async findByPrompt(
        prompt: string,
        limit?: number,
        query?: Record<string, any>
    ) {
        const results = await this.db.find(
            this.collectionName,
            {
                $prompt: prompt,
                ...query,
            },
            {
                limit: limit ?? 1,
            }
        )

        assert.isLength(
            results,
            limit ?? 1,
            'Expected to find one result from $prompt'
        )
        return results
    }

    private async createSearchableDocuments(code?: string) {
        return await this.db.create(this.collectionName, [
            { name: 'peter piper picked a pepper', code },
            { name: 'this is down', code },
            { cheesey: 'this is a burrito', code },
            { stinky: 'cheese', hello: 'world', code },
            { stinky: 'cheese', world: 'hello', code },
            { name: 'limbo', code },
            { whatever: 'you say', code },
            { name: "arby's", code },
            { name: 'mcdonalds', code },
            { name: 'wendys', code },
            { name: 'taco bell', code },
            { name: 'burger king', code },
            { name: 'kfc', code },
            { name: 'popeyes', code },
            { name: 'chick-fil-a', code },
            { name: 'subway', code },
            { name: 'dominos', code },
            { name: 'pizza hut', code },
            { name: 'little caesars', code },
        ])
    }

    private async getOrCreateCollection(
        collectionName?: string
    ): Promise<Collection> {
        return await this.chroma.getOrCreateCollection({
            name: collectionName ?? this.collectionName,
            embeddingFunction: this.embedding,
        })
    }

    private async setEmbedFieldsAndAssertEmbeddingsEqual(
        embeddingFields: string[],
        embeddingPrompt: string,
        values: Record<string, any>
    ) {
        this.setEmbeddingFields(embeddingFields)
        await this.assertEmbeddingsEqual(values, embeddingPrompt)
    }

    private async assertEmbeddingsEqual(
        values: Record<string, any>,
        embeddingPrompt: string
    ) {
        const record = await this.createOne(values)
        const match = await this.getById(record.id)
        const embeddings = await this.generateEmbeddings([embeddingPrompt])
        assert.isEqualDeep(
            match.embeddings?.[0],
            embeddings[0],
            `The embeddings for ${JSON.stringify(record)} did not match based on the prompt 'Hello'.`
        )
    }

    private setEmbeddingFields(fields: string[], collectionName?: string) {
        ChromaDatabase.setEmbeddingsFields(
            collectionName ?? this.collectionName,
            fields
        )
    }

    private async assertOperationThrowsNotSupported(
        cb: () => Promise<any>,
        operation: string
    ) {
        const err = await assert.doesThrowAsync(
            cb,
            undefined,
            `Expected ${operation} to throw`
        )
        errorAssert.assertError(err, 'FEATURE_NOT_SUPPORTED', {
            operation,
        })
    }

    private async createOneAndAssertExpectedEmbeddings(
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

        //need to round the embeddings to avoid floating point precision issues
        const roundEmbedding = (embedding: number[]) => {
            return embedding.map((num) => parseFloat(num.toFixed(4)))
        }

        assert.isEqualDeep(
            roundEmbedding(match.embeddings?.[0]),
            roundEmbedding(expected[0]),
            `The embeddings for ${JSON.stringify(values)} did not match based on the prompt '${prompt}'.`
        )
    }

    private async getById(id: string) {
        return await this.collection.get({
            ids: [id],
            include: ['embeddings' as IncludeEnum, 'documents' as IncludeEnum],
        })
    }

    private async generateEmbeddings(prompts: string[]) {
        return await this.embedding.generate(prompts)
    }

    private async createOne(values: Record<string, any>) {
        return await this.db.createOne(this.collectionName, values)
    }
}

const chromaConnect: TestConnect = async (connectionString?: string) => {
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

class SpyOllamaEmbeddingFunction extends OllamaEmbeddingFunction {
    public static instance?: SpyOllamaEmbeddingFunction

    public constructorOptions?: { url: string; model: string }

    public constructor({ url, model }: { url: string; model: string }) {
        super({ url, model })
        this.constructorOptions = { url, model }
        SpyOllamaEmbeddingFunction.instance = this
    }
}
