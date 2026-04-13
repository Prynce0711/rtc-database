type ActionResult<T, E = undefined> =
  | {
      success: true;
      result: T;
    }
  | {
      success: false;
      error?: string;
      errorResult?: E;
    };

export default ActionResult;
