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
        ])
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
