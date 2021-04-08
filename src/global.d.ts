import * as url from "url";

declare global {
  class URL extends url.URL {}
  class URLSearchParams extends url.URLSearchParams {}
}
