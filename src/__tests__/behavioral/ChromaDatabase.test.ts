import { Database, databaseAssert, TestConnect } from '@sprucelabs/data-stores'
import AbstractSpruceTest, {
    test,
    assert,
    errorAssert,
    generateId,
} from '@sprucelabs/test-utils'
import { ChromaClient, IncludeEnum, OllamaEmbeddingFunction } from 'chromadb'
import { Collection } from '../../chroma.types'
import ChromaDatabase from '../../ChromaDatabase'

export default class ChromaDatabaseTest extends AbstractSpruceTest {
    private static embedding: OllamaEmbeddingFunction
    private static db: Database
    private static collectionName: string
    private static chroma: ChromaClient
    private static collection: Collection

    protected static async beforeEach() {
        await super.beforeEach()

        ChromaDatabase.clearEmbeddingsFields()

        this.chroma = new ChromaClient({ path: 'http://localhost:8000' })
        this.embedding = new OllamaEmbeddingFunction({
            model: 'llama3.2',
            url: 'http://localhost:11434/api/embeddings',
        })

        const { db } = await chromaConnect()

        this.db = db
        this.collectionName = generateId()
        this.collection = await this.getOrCreateCollection()
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

    @test()
    protected static async throwsExpectedErrorForUnsupportedFeatures() {
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
    protected static async runsSuiteOfDatabaseTests() {
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
            '!assertSyncingUniqueIndexesSkipsExistingIndexes',
            '!assertSyncingUniqueIndexesRemovesExtraIndexes',
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
            '!assertSyncingIndexesDoesNotAddAndRemove',
            '!assertNestedFieldIndexUpdates',
            '!assertSyncingUniqueIndexesIsRaceProof',
            '!assertUpsertWithUniqueIndex',
        ])
    }

    @test()
    protected static async canSetSingleEmbeddingField() {
        await this.setEmbedFieldsAndAssertEmbeddingsEqual(['name'], 'Hello', {
            name: 'Hello',
            test: true,
        })
    }

    @test()
    protected static async canSetDifferentSingleEmbeddingField() {
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
    protected static async canSetMultipleFieldsOnEmbedding() {
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
    protected static async embeddingFieldsHonorsCollection() {
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
    protected static async dropDatabaseDeletesAllCollections() {
        await this.getOrCreateCollection(generateId())
        await this.getOrCreateCollection(generateId())
        await this.getOrCreateCollection(generateId())
        await this.db.dropDatabase()

        const client = new ChromaClient({ path: 'http://localhost:8000' })
        const collections = await client.listCollections()
        assert.isLength(collections, 0, 'Collections were not deleted')
    }

    @test()
    protected static async doesTextSearchWith$promptKey() {
        const created = await this.createSearchableDocuments()
        const results = await this.findByPrompt('down')

        assert.isEqualDeep(
            results[0],
            created[1],
            'Searching based on $prompt did not return the expected match'
        )
    }

    @test()
    protected static async canFindUsingDifferent$promptKey() {
        const created = await this.createSearchableDocuments()
        const results = await this.findByPrompt('pepper')

        assert.isEqualDeep(
            results[0],
            created[0],
            'Searching based on $prompt did not return the expected match'
        )
    }

    @test()
    protected static async canFindUsingDifferentLimit() {
        await this.createSearchableDocuments()
        const results = await this.findByPrompt('pepper', 2)
        assert.isLength(results, 2, 'Expected to find two results')
    }

    @test()
    protected static async canSearchByPromptAndDocumentFields() {
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
    protected static async canSearchSamePromptAndDifferentDocumentFields() {
        const created = await this.createSearchableDocuments()
        const results = await this.findByPrompt('cheese', 1, { world: 'hello' })
        const expected = created[4]
        assert.isEqualDeep(
            results[0],
            expected,
            'Searching based on $prompt and document fields did not return the expected match'
        )
    }

    private static async findByPrompt(
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

    private static async createSearchableDocuments() {
        return await this.db.create(this.collectionName, [
            { name: 'peter piper picked a pepper' },
            { name: 'this is down' },
            { cheesey: 'this is a burrito' },
            { stinky: 'cheese', hello: 'world' },
            { stinky: 'cheese', world: 'hello' },
        ])
    }

    private static async getOrCreateCollection(
        collectionName?: string
    ): Promise<Collection> {
        return await this.chroma.getOrCreateCollection({
            name: collectionName ?? this.collectionName,
            embeddingFunction: this.embedding,
        })
    }

    private static async setEmbedFieldsAndAssertEmbeddingsEqual(
        embeddingFields: string[],
        embeddingPrompt: string,
        values: Record<string, any>
    ) {
        this.setEmbeddingFields(embeddingFields)
        await this.assertEmbeddingsEqual(values, embeddingPrompt)
    }

    private static async assertEmbeddingsEqual(
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

    private static setEmbeddingFields(
        fields: string[],
        collectionName?: string
    ) {
        ChromaDatabase.setEmbeddingsFields(
            collectionName ?? this.collectionName,
            fields
        )
    }

    private static async assertOperationThrowsNotSupported(
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