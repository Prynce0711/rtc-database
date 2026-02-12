export default function SpeederLoader() {
  return (
    <div className="relative flex justify-center items-center h-56">
      <div className="transform scale-125">
        <div className="loader">
          <span>
            <span></span>
            <span></span>
            <span></span>
            <span></span>
          </span>

          <div className="base">
            <span></span>
            <div className="face"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
