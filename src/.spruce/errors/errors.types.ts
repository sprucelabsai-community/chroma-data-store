import { default as SchemaEntity } from '@sprucelabs/schema'
import * as SpruceSchema from '@sprucelabs/schema'





export declare namespace SpruceErrors.ChromaDataStore {

	
	export interface FeatureNotSupported {
		
			
			'operation': string
	}

	export interface FeatureNotSupportedSchema extends SpruceSchema.Schema {
		id: 'featureNotSupported',
		namespace: 'ChromaDataStore',
		name: 'Feature not supported',
		    fields: {
		            /** . */
		            'operation': {
		                type: 'text',
		                isRequired: true,
		                options: undefined
		            },
		    }
	}

	export type FeatureNotSupportedEntity = SchemaEntity<SpruceErrors.ChromaDataStore.FeatureNotSupportedSchema>

}




