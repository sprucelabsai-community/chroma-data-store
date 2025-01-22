import AbstractSpruceTest, {
    test,
    assert,
    generateId,
    errorAssert,
} from '@sprucelabs/test-utils'
import ChromaDatabase from '../../ChromaDatabase'
import chromaDbAssert from '../../chromaDbAssert.utility'
import MockChromaDatabase from '../../MockChromaDatabase'

export default class TestingWithChromaDatabaseTest extends AbstractSpruceTest {
    private static db: MockChromaDatabase
    private static connectionString: string

    protected static async beforeEach(): Promise<void> {
        await super.beforeEach()

        this.connectionString = 'chroma://' + generateId()

        ChromaDatabase.Class = MockChromaDatabase
        this.db = ChromaDatabase.Database(
            this.connectionString
        ) as MockChromaDatabase
    }

    @test()
    protected static async canCreateFakeChromaDatabase() {
        assert.isInstanceOf(this.db, MockChromaDatabase)
    }

    @test()
    protected static async assertConnectionStringThrowsWhenNotEqual() {
        assert.doesThrow(() =>
            this.db.assertConnectionStringEquals('chroma://' + generateId())
        )
    }

    @test()
    protected static async assertConnectionStringEquals() {
        this.db.assertConnectionStringEquals(this.connectionString)
    }

    @test()
    protected static async canAssertEmbeddingFieldsThrowsWithMissing() {
        const err = assert.doesThrow(() =>
            //@ts-ignore
            this.assertEmbeddingFieldsEqual()
        )
        errorAssert.assertError(err, 'MISSING_PARAMETERS', {
            parameters: ['collection', 'fields'],
        })
    }

    @test()
    protected static async canAssertEmbeddingFields() {
        this.setEmbeddingFieldsAndAssertFieldsEqual(generateId(), [
            'id',
            'name',
        ])

        this.setEmbeddingFieldsAndAssertFieldsEqual(generateId(), [
            generateId(),
        ])
    }

    @test()
    protected static async assertThrowsIfCollectionNameDoesNotMatch() {
        this.setEmbeddingFields(generateId(), ['id', 'name'])
        this.assertEmbeddingFieldsEqualThrows(generateId(), ['id', 'name'])
    }

    @test()
    protected static async throwsWhenFieldsDoNotMatch() {
        const collectionName = generateId()
        this.setEmbeddingFields(collectionName, ['id', 'name'])
        this.assertEmbeddingFieldsEqualThrows(collectionName, [
            'id',
            'name',
            'age',
        ])
    }

    @test()
    protected static async canAssertWasConnected() {
        assert.doesThrow(() => this.db.assertIsConnected())
        await this.db.connect()
        this.db.assertIsConnected()
    }

    private static setEmbeddingFieldsAndAssertFieldsEqual(
        collectionName: string,
        fields: string[]
    ) {
        this.setEmbeddingFields(collectionName, fields)
        this.assertEmbeddingFieldsEqual(collectionName, fields)
    }

    private static assertEmbeddingFieldsEqualThrows(
        collection: string,
        fields: string[]
    ) {
        assert.doesThrow(() =>
            this.assertEmbeddingFieldsEqual(collection, fields)
        )
    }

    private static assertEmbeddingFieldsEqual(
        collection: string,
        fields: string[]
    ) {
        chromaDbAssert.embeddingFieldsForCollectionEqual(collection, fields)
    }

    private static setEmbeddingFields(
        collectionName: string,
        fields: string[]
    ) {
        ChromaDatabase.setEmbeddingsFields(collectionName, fields)
    }
}
