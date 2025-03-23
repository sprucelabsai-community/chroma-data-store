import AbstractSpruceTest, {
    test,
    suite,
    assert,
    generateId,
    errorAssert,
} from '@sprucelabs/test-utils'
import ChromaDatabase from '../../ChromaDatabase'
import chromaDbAssert from '../../chromaDbAssert.utility'
import MockChromaDatabase from '../../MockChromaDatabase'

@suite()
export default class TestingWithChromaDatabaseTest extends AbstractSpruceTest {
    private db!: MockChromaDatabase
    private connectionString!: string

    protected async beforeEach(): Promise<void> {
        await super.beforeEach()

        this.connectionString = 'chroma://' + generateId()

        ChromaDatabase.Class = MockChromaDatabase
        this.db = ChromaDatabase.Database(
            this.connectionString
        ) as MockChromaDatabase
    }

    @test()
    protected async canCreateFakeChromaDatabase() {
        assert.isInstanceOf(this.db, MockChromaDatabase)
    }

    @test()
    protected async assertConnectionStringThrowsWhenNotEqual() {
        assert.doesThrow(() =>
            this.db.assertConnectionStringEquals('chroma://' + generateId())
        )
    }

    @test()
    protected async assertConnectionStringEquals() {
        this.db.assertConnectionStringEquals(this.connectionString)
    }

    @test()
    protected async canAssertEmbeddingFieldsThrowsWithMissing() {
        const err = assert.doesThrow(() =>
            //@ts-ignore
            this.assertEmbeddingFieldsEqual()
        )
        errorAssert.assertError(err, 'MISSING_PARAMETERS', {
            parameters: ['collection', 'fields'],
        })
    }

    @test()
    protected async canAssertEmbeddingFields() {
        this.setEmbeddingFieldsAndAssertFieldsEqual(generateId(), [
            'id',
            'name',
        ])

        this.setEmbeddingFieldsAndAssertFieldsEqual(generateId(), [
            generateId(),
        ])
    }

    @test()
    protected async assertThrowsIfCollectionNameDoesNotMatch() {
        this.setEmbeddingFields(generateId(), ['id', 'name'])
        this.assertEmbeddingFieldsEqualThrows(generateId(), ['id', 'name'])
    }

    @test()
    protected async throwsWhenFieldsDoNotMatch() {
        const collectionName = generateId()
        this.setEmbeddingFields(collectionName, ['id', 'name'])
        this.assertEmbeddingFieldsEqualThrows(collectionName, [
            'id',
            'name',
            'age',
        ])
    }

    @test()
    protected async canAssertWasConnected() {
        assert.doesThrow(() => this.db.assertIsConnected())
        await this.db.connect()
        this.db.assertIsConnected()
    }

    private setEmbeddingFieldsAndAssertFieldsEqual(
        collectionName: string,
        fields: string[]
    ) {
        this.setEmbeddingFields(collectionName, fields)
        this.assertEmbeddingFieldsEqual(collectionName, fields)
    }

    private assertEmbeddingFieldsEqualThrows(
        collection: string,
        fields: string[]
    ) {
        assert.doesThrow(() =>
            this.assertEmbeddingFieldsEqual(collection, fields)
        )
    }

    private assertEmbeddingFieldsEqual(collection: string, fields: string[]) {
        chromaDbAssert.embeddingFieldsForCollectionEqual(collection, fields)
    }

    private setEmbeddingFields(collectionName: string, fields: string[]) {
        ChromaDatabase.setEmbeddingsFields(collectionName, fields)
    }
}
