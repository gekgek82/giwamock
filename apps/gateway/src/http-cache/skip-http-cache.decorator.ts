import { SetMetadata } from '@nestjs/common';

export const SKIP_HTTP_CACHE = 'gateway:skipHttpCache' as const;

/** Opt a handler out of the global Redis GET cache. */
export const SkipHttpCache = () => SetMetadata(SKIP_HTTP_CACHE, true);
