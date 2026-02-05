type ActionResult<T> =
  | {
      success: true;
      result: T;
    }
  | {
      success: false;
      error?: string;
    };

export default ActionResult;
