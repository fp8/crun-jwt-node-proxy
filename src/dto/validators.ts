import { ValidationOptions, ValidateBy } from 'class-validator';
import { JwtConfig } from './config.dto';

// Custom validator to ensure mapper keys start with authHeaderPrefix
export function IsMapperKeysValid(validationOptions?: ValidationOptions) {
  // Needs to capture the authHeaderPrefix and invalid headers to pass to the error message
  let invalidHeader: string | undefined;
  let authHeaderPrefix: string | undefined;
  return ValidateBy(
    {
      name: 'isMapperKeysValid',
      validator: {
        validate(value: Record<string, string>, args) {
          // Must set the authHeaderPrefix on all validation calls
          const object = args?.object as JwtConfig;
          if (!object?.authHeaderPrefix || !value) {
            return true; // Skip validation if no prefix or no mapper
          }
          authHeaderPrefix = object.authHeaderPrefix;
          // Create a lowercase version for the actual check
          const checkHeaderPrefix = authHeaderPrefix.toLowerCase();

          let badHeader: string | undefined;
          /*
          Check if all mapper values (header names) start with the prefix.
          Can only capture one invalid header at a time
          */
          const output = Object.values(value).every((headerName) => {
            if (headerName.toLowerCase().startsWith(checkHeaderPrefix)) {
              return true; // Valid header
            } else {
              badHeader = headerName;
              return false; // Invalid header
            }
          });
          invalidHeader = badHeader; // Store invalid header for the error message

          return output;
        },
        defaultMessage() {
          return `Mapper value ${invalidHeader} must start with ${authHeaderPrefix}`;
        },
      },
    },
    validationOptions,
  );
}
