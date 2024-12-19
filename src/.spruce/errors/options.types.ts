import { SpruceErrors } from "#spruce/errors/errors.types"
import { ErrorOptions as ISpruceErrorOptions} from "@sprucelabs/error"

export interface FeatureNotSupportedErrorOptions extends SpruceErrors.ChromaDataStore.FeatureNotSupported, ISpruceErrorOptions {
	code: 'FEATURE_NOT_SUPPORTED'
}

type ErrorOptions =  | FeatureNotSupportedErrorOptions 

export default ErrorOptions
