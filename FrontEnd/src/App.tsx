import { useState } from 'react'
import './App.css'
import { RTCData, sampleData } from './assets/components/SampleData'

function App() {
  const [data, setData] = useState<RTCData[] | null>(sampleData)

  return (
    <>
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">RTC Sample Data</h1>
        <ul>
          {data?.map((item) => (
            <li key={item.id} className="mb-2">
              <span className="font-semibold">{item.name}:</span> {item.value}
            </li>
          ))}
        </ul>
      </div>  
    </>
  )
}

export default App
