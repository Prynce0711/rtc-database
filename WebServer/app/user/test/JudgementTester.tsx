"use client";

import {
  mtcLeafColumns,
  rtcLeafColumns,
} from "@/app/components/Statistics/Judgement/JudgementColumnDef";
import {
  MTCJudgementRow,
  RTCJudgementRow,
} from "@/app/components/Statistics/Judgement/Schema";
import { useEffect, useState } from "react";
import {
  createMunicipalJudgement,
  createRegionalJudgement,
  deleteMunicipalJudgement,
  deleteRegionalJudgement,
  getMunicipalJudgements,
  getRegionalJudgements,
  updateMunicipalJudgement,
  updateRegionalJudgement,
} from "../../components/Statistics/Judgement/judgementActions";

export default function JudgementTester() {
  const [mtc, setMtc] = useState<MTCJudgementRow[]>([]);
  const [rtc, setRtc] = useState<RTCJudgementRow[]>([]);
  const [activeTab, setActiveTab] = useState<"mtc" | "rtc">("mtc");

  const emptyMtc: MTCJudgementRow = {
    branchNo: "",
    civilV: 0,
    civilInC: 0,
    criminalV: 0,
    criminalInC: 0,
    totalHeard: 0,
    disposedCivil: 0,
    disposedCrim: 0,
    totalDisposed: 0,
    pdlM: 0,
    pdlF: 0,
    pdlTotal: 0,
    pdlV: 0,
    pdlI: 0,
    pdlBail: 0,
    pdlRecognizance: 0,
    pdlMinRor: 0,
    pdlMaxSentence: 0,
    pdlDismissal: 0,
    pdlAcquittal: 0,
    pdlMinSentence: 0,
    pdlOthers: 0,
    total: 0,
  } as MTCJudgementRow;
  const emptyRtc: RTCJudgementRow = {
    branchNo: "",
    civilV: 0,
    civilInC: 0,
    criminalV: 0,
    criminalInC: 0,
    totalHeard: 0,
    disposedCivil: 0,
    disposedCrim: 0,
    summaryProc: 0,
    casesDisposed: 0,
    pdlM: 0,
    pdlF: 0,
    pdlCICL: 0,
    pdlTotal: 0,
    pdlV: 0,
    pdlInC: 0,
    pdlBail: 0,
    pdlRecognizance: 0,
    pdlMinRor: 0,
    pdlMaxSentence: 0,
    pdlDismissal: 0,
    pdlAcquittal: 0,
    pdlMinSentence: 0,
    pdlProbation: 0,
    ciclM: 0,
    ciclF: 0,
    ciclV: 0,
    ciclInC: 0,
    fine: 0,
    total: 0,
  } as RTCJudgementRow;

  const [formMtc, setFormMtc] = useState<MTCJudgementRow>(emptyMtc);
  const [formRtc, setFormRtc] = useState<RTCJudgementRow>(emptyRtc);
  const [editingMtcId, setEditingMtcId] = useState<number | null>(null);
  const [editingRtcId, setEditingRtcId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    const r1 = await getMunicipalJudgements();
    if (r1.success) setMtc(r1.result);
    const r2 = await getRegionalJudgements();
    if (r2.success) setRtc(r2.result);
    setLoading(false);
  };

  const handleMtcSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      let res;
      if (editingMtcId) {
        res = await updateMunicipalJudgement(editingMtcId, formMtc);
        if (res.success)
          setMessage({ type: "success", text: "Municipal updated" });
      } else {
        res = await createMunicipalJudgement(formMtc);
        if (res.success)
          setMessage({ type: "success", text: "Municipal created" });
      }
      if (!res || !res.success)
        setMessage({ type: "error", text: res?.error || "Operation failed" });
      else {
        setFormMtc(emptyMtc);
        setEditingMtcId(null);
        await loadAll();
      }
    } catch (err) {
      setMessage({ type: "error", text: "Error" });
    }
    setLoading(false);
  };

  const handleRtcSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      let res;
      if (editingRtcId) {
        res = await updateRegionalJudgement(editingRtcId, formRtc);
        if (res.success)
          setMessage({ type: "success", text: "Regional updated" });
      } else {
        res = await createRegionalJudgement(formRtc);
        if (res.success)
          setMessage({ type: "success", text: "Regional created" });
      }
      if (!res || !res.success)
        setMessage({ type: "error", text: res?.error || "Operation failed" });
      else {
        setFormRtc(emptyRtc);
        setEditingRtcId(null);
        await loadAll();
      }
    } catch (err) {
      setMessage({ type: "error", text: "Error" });
    }
    setLoading(false);
  };

  const handleDeleteMtc = async (id: number) => {
    if (!confirm("Delete municipal record?")) return;
    setLoading(true);
    const res = await deleteMunicipalJudgement(id);
    if (res.success) {
      setMessage({ type: "success", text: "Municipal deleted" });
      await loadAll();
    } else setMessage({ type: "error", text: res.error || "Failed" });
    setLoading(false);
  };

  const handleDeleteRtc = async (id: number) => {
    if (!confirm("Delete regional record?")) return;
    setLoading(true);
    const res = await deleteRegionalJudgement(id);
    if (res.success) {
      setMessage({ type: "success", text: "Regional deleted" });
      await loadAll();
    } else setMessage({ type: "error", text: res.error || "Failed" });
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Judgement Tester</h1>

        {message && (
          <div
            className={`mb-4 p-4 rounded ${
              message.type === "success"
                ? "bg-green-100 text-green-700"
                : "bg-red-100 text-red-700"
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab("mtc")}
            className={`px-4 py-2 rounded font-medium ${
              activeTab === "mtc"
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-700 border hover:bg-gray-50"
            }`}
          >
            Municipal (MTC)
          </button>
          <button
            onClick={() => setActiveTab("rtc")}
            className={`px-4 py-2 rounded font-medium ${
              activeTab === "rtc"
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-700 border hover:bg-gray-50"
            }`}
          >
            Regional (RTC)
          </button>
        </div>

        {activeTab === "mtc" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold mb-4">
                  {editingMtcId ? "Edit Municipal" : "Add Municipal"}
                </h2>
                <form onSubmit={handleMtcSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Branch No
                    </label>
                    <input
                      className="w-full border rounded px-3 py-2"
                      value={formMtc.branchNo || ""}
                      onChange={(e) =>
                        setFormMtc({ ...formMtc, branchNo: e.target.value })
                      }
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Civil V
                      </label>
                      <input
                        type="number"
                        className="w-full border rounded px-3 py-2"
                        value={(formMtc.civilV as any) || 0}
                        onChange={(e) =>
                          setFormMtc({
                            ...formMtc,
                            civilV: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Civil In-C
                      </label>
                      <input
                        type="number"
                        className="w-full border rounded px-3 py-2"
                        value={(formMtc.civilInC as any) || 0}
                        onChange={(e) =>
                          setFormMtc({
                            ...formMtc,
                            civilInC: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Criminal V
                      </label>
                      <input
                        type="number"
                        className="w-full border rounded px-3 py-2"
                        value={(formMtc.criminalV as any) || 0}
                        onChange={(e) =>
                          setFormMtc({
                            ...formMtc,
                            criminalV: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Criminal In-C
                      </label>
                      <input
                        type="number"
                        className="w-full border rounded px-3 py-2"
                        value={(formMtc.criminalInC as any) || 0}
                        onChange={(e) =>
                          setFormMtc({
                            ...formMtc,
                            criminalInC: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Total Heard
                    </label>
                    <input
                      type="number"
                      className="w-full border rounded px-3 py-2"
                      value={(formMtc.totalHeard as any) || 0}
                      onChange={(e) =>
                        setFormMtc({
                          ...formMtc,
                          totalHeard: Number(e.target.value),
                        })
                      }
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Disposed Civil
                      </label>
                      <input
                        type="number"
                        className="w-full border rounded px-3 py-2"
                        value={(formMtc.disposedCivil as any) || 0}
                        onChange={(e) =>
                          setFormMtc({
                            ...formMtc,
                            disposedCivil: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Disposed Crim
                      </label>
                      <input
                        type="number"
                        className="w-full border rounded px-3 py-2"
                        value={(formMtc.disposedCrim as any) || 0}
                        onChange={(e) =>
                          setFormMtc({
                            ...formMtc,
                            disposedCrim: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Total Disposed
                    </label>
                    <input
                      type="number"
                      className="w-full border rounded px-3 py-2"
                      value={(formMtc.totalDisposed as any) || 0}
                      onChange={(e) =>
                        setFormMtc({
                          ...formMtc,
                          totalDisposed: Number(e.target.value),
                        })
                      }
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        PDL M
                      </label>
                      <input
                        type="number"
                        className="w-full border rounded px-3 py-2"
                        value={(formMtc.pdlM as any) || 0}
                        onChange={(e) =>
                          setFormMtc({
                            ...formMtc,
                            pdlM: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        PDL F
                      </label>
                      <input
                        type="number"
                        className="w-full border rounded px-3 py-2"
                        value={(formMtc.pdlF as any) || 0}
                        onChange={(e) =>
                          setFormMtc({
                            ...formMtc,
                            pdlF: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        PDL Total
                      </label>
                      <input
                        type="number"
                        className="w-full border rounded px-3 py-2"
                        value={(formMtc.pdlTotal as any) || 0}
                        onChange={(e) =>
                          setFormMtc({
                            ...formMtc,
                            pdlTotal: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        PDL V
                      </label>
                      <input
                        type="number"
                        className="w-full border rounded px-3 py-2"
                        value={(formMtc.pdlV as any) || 0}
                        onChange={(e) =>
                          setFormMtc({
                            ...formMtc,
                            pdlV: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        PDL I
                      </label>
                      <input
                        type="number"
                        className="w-full border rounded px-3 py-2"
                        value={(formMtc.pdlI as any) || 0}
                        onChange={(e) =>
                          setFormMtc({
                            ...formMtc,
                            pdlI: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        PDL Bail
                      </label>
                      <input
                        type="number"
                        className="w-full border rounded px-3 py-2"
                        value={(formMtc.pdlBail as any) || 0}
                        onChange={(e) =>
                          setFormMtc({
                            ...formMtc,
                            pdlBail: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      PDL Recognizance
                    </label>
                    <input
                      type="number"
                      className="w-full border rounded px-3 py-2"
                      value={(formMtc.pdlRecognizance as any) || 0}
                      onChange={(e) =>
                        setFormMtc({
                          ...formMtc,
                          pdlRecognizance: Number(e.target.value),
                        })
                      }
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        PDL Min/ROR
                      </label>
                      <input
                        type="number"
                        className="w-full border rounded px-3 py-2"
                        value={(formMtc.pdlMinRor as any) || 0}
                        onChange={(e) =>
                          setFormMtc({
                            ...formMtc,
                            pdlMinRor: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        PDL Max Sentence
                      </label>
                      <input
                        type="number"
                        className="w-full border rounded px-3 py-2"
                        value={(formMtc.pdlMaxSentence as any) || 0}
                        onChange={(e) =>
                          setFormMtc({
                            ...formMtc,
                            pdlMaxSentence: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        PDL Dismissal
                      </label>
                      <input
                        type="number"
                        className="w-full border rounded px-3 py-2"
                        value={(formMtc.pdlDismissal as any) || 0}
                        onChange={(e) =>
                          setFormMtc({
                            ...formMtc,
                            pdlDismissal: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        PDL Acquittal
                      </label>
                      <input
                        type="number"
                        className="w-full border rounded px-3 py-2"
                        value={(formMtc.pdlAcquittal as any) || 0}
                        onChange={(e) =>
                          setFormMtc({
                            ...formMtc,
                            pdlAcquittal: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        PDL Min Sentence
                      </label>
                      <input
                        type="number"
                        className="w-full border rounded px-3 py-2"
                        value={(formMtc.pdlMinSentence as any) || 0}
                        onChange={(e) =>
                          setFormMtc({
                            ...formMtc,
                            pdlMinSentence: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        PDL Others
                      </label>
                      <input
                        type="number"
                        className="w-full border rounded px-3 py-2"
                        value={(formMtc.pdlOthers as any) || 0}
                        onChange={(e) =>
                          setFormMtc({
                            ...formMtc,
                            pdlOthers: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Total
                    </label>
                    <input
                      type="number"
                      className="w-full border rounded px-3 py-2"
                      value={(formMtc.total as any) || 0}
                      onChange={(e) =>
                        setFormMtc({
                          ...formMtc,
                          total: Number(e.target.value),
                        })
                      }
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 bg-blue-500 text-white py-2 rounded"
                    >
                      {editingMtcId ? "Update" : "Add"}
                    </button>
                    {editingMtcId && (
                      <button
                        type="button"
                        onClick={() => {
                          setFormMtc(emptyMtc);
                          setEditingMtcId(null);
                        }}
                        className="flex-1 bg-gray-500 text-white py-2 rounded"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              </div>
            </div>

            <div className="lg:col-span-2">
              <div className="bg-white rounded-lg shadow p-6 mb-6">
                <div className="flex gap-2">
                  <button
                    onClick={loadAll}
                    disabled={loading}
                    className="bg-green-500 text-white px-4 py-2 rounded"
                  >
                    Refresh
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-200">
                    <tr>
                      <th className="px-4 py-2 text-left">ID</th>
                      {mtcLeafColumns.map((c) => (
                        <th key={c.key} className="px-4 py-2 text-left">
                          {c.key}
                        </th>
                      ))}
                      <th className="px-4 py-2 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mtc.length === 0 ? (
                      <tr>
                        <td
                          colSpan={mtcLeafColumns.length + 2}
                          className="px-4 py-4 text-center text-gray-500"
                        >
                          No municipal records
                        </td>
                      </tr>
                    ) : (
                      mtc.map((r) => (
                        <tr key={r.id} className="border-t hover:bg-gray-50">
                          <td className="px-4 py-2">{r.id}</td>
                          {mtcLeafColumns.map((c) => (
                            <td key={c.key} className="px-4 py-2">
                              {c.render(r as Record<string, unknown>)}
                            </td>
                          ))}
                          <td className="px-4 py-2">
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  setFormMtc(r);
                                  setEditingMtcId(r.id || null);
                                }}
                                className="bg-yellow-400 px-3 py-1 rounded text-xs"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => r.id && handleDeleteMtc(r.id)}
                                className="bg-red-500 text-white px-3 py-1 rounded text-xs"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === "rtc" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold mb-4">
                  {editingRtcId ? "Edit Regional" : "Add Regional"}
                </h2>
                <form onSubmit={handleRtcSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Branch No
                    </label>
                    <input
                      className="w-full border rounded px-3 py-2"
                      value={formRtc.branchNo || ""}
                      onChange={(e) =>
                        setFormRtc({ ...formRtc, branchNo: e.target.value })
                      }
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Civil V
                      </label>
                      <input
                        type="number"
                        className="w-full border rounded px-3 py-2"
                        value={(formRtc.civilV as any) || 0}
                        onChange={(e) =>
                          setFormRtc({
                            ...formRtc,
                            civilV: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Civil In-C
                      </label>
                      <input
                        type="number"
                        className="w-full border rounded px-3 py-2"
                        value={(formRtc.civilInC as any) || 0}
                        onChange={(e) =>
                          setFormRtc({
                            ...formRtc,
                            civilInC: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Criminal V
                      </label>
                      <input
                        type="number"
                        className="w-full border rounded px-3 py-2"
                        value={(formRtc.criminalV as any) || 0}
                        onChange={(e) =>
                          setFormRtc({
                            ...formRtc,
                            criminalV: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Criminal In-C
                      </label>
                      <input
                        type="number"
                        className="w-full border rounded px-3 py-2"
                        value={(formRtc.criminalInC as any) || 0}
                        onChange={(e) =>
                          setFormRtc({
                            ...formRtc,
                            criminalInC: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Total Heard
                    </label>
                    <input
                      type="number"
                      className="w-full border rounded px-3 py-2"
                      value={(formRtc.totalHeard as any) || 0}
                      onChange={(e) =>
                        setFormRtc({
                          ...formRtc,
                          totalHeard: Number(e.target.value),
                        })
                      }
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Disposed Civil
                      </label>
                      <input
                        type="number"
                        className="w-full border rounded px-3 py-2"
                        value={(formRtc.disposedCivil as any) || 0}
                        onChange={(e) =>
                          setFormRtc({
                            ...formRtc,
                            disposedCivil: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Disposed Crim
                      </label>
                      <input
                        type="number"
                        className="w-full border rounded px-3 py-2"
                        value={(formRtc.disposedCrim as any) || 0}
                        onChange={(e) =>
                          setFormRtc({
                            ...formRtc,
                            disposedCrim: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Cases Disposed
                    </label>
                    <input
                      type="number"
                      className="w-full border rounded px-3 py-2"
                      value={(formRtc.casesDisposed as any) || 0}
                      onChange={(e) =>
                        setFormRtc({
                          ...formRtc,
                          casesDisposed: Number(e.target.value),
                        })
                      }
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Summary Proc
                      </label>
                      <input
                        type="number"
                        className="w-full border rounded px-3 py-2"
                        value={(formRtc.summaryProc as any) || 0}
                        onChange={(e) =>
                          setFormRtc({
                            ...formRtc,
                            summaryProc: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Cases Disposed
                      </label>
                      <input
                        type="number"
                        className="w-full border rounded px-3 py-2"
                        value={(formRtc.casesDisposed as any) || 0}
                        onChange={(e) =>
                          setFormRtc({
                            ...formRtc,
                            casesDisposed: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        PDL M
                      </label>
                      <input
                        type="number"
                        className="w-full border rounded px-3 py-2"
                        value={(formRtc.pdlM as any) || 0}
                        onChange={(e) =>
                          setFormRtc({
                            ...formRtc,
                            pdlM: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        PDL F
                      </label>
                      <input
                        type="number"
                        className="w-full border rounded px-3 py-2"
                        value={(formRtc.pdlF as any) || 0}
                        onChange={(e) =>
                          setFormRtc({
                            ...formRtc,
                            pdlF: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        PDL CICL
                      </label>
                      <input
                        type="number"
                        className="w-full border rounded px-3 py-2"
                        value={(formRtc.pdlCICL as any) || 0}
                        onChange={(e) =>
                          setFormRtc({
                            ...formRtc,
                            pdlCICL: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        PDL Total
                      </label>
                      <input
                        type="number"
                        className="w-full border rounded px-3 py-2"
                        value={(formRtc.pdlTotal as any) || 0}
                        onChange={(e) =>
                          setFormRtc({
                            ...formRtc,
                            pdlTotal: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        PDL V
                      </label>
                      <input
                        type="number"
                        className="w-full border rounded px-3 py-2"
                        value={(formRtc.pdlV as any) || 0}
                        onChange={(e) =>
                          setFormRtc({
                            ...formRtc,
                            pdlV: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        PDL InC
                      </label>
                      <input
                        type="number"
                        className="w-full border rounded px-3 py-2"
                        value={(formRtc.pdlInC as any) || 0}
                        onChange={(e) =>
                          setFormRtc({
                            ...formRtc,
                            pdlInC: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        PDL Bail
                      </label>
                      <input
                        type="number"
                        className="w-full border rounded px-3 py-2"
                        value={(formRtc.pdlBail as any) || 0}
                        onChange={(e) =>
                          setFormRtc({
                            ...formRtc,
                            pdlBail: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        PDL Recognizance
                      </label>
                      <input
                        type="number"
                        className="w-full border rounded px-3 py-2"
                        value={(formRtc.pdlRecognizance as any) || 0}
                        onChange={(e) =>
                          setFormRtc({
                            ...formRtc,
                            pdlRecognizance: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        PDL Min/ROR
                      </label>
                      <input
                        type="number"
                        className="w-full border rounded px-3 py-2"
                        value={(formRtc.pdlMinRor as any) || 0}
                        onChange={(e) =>
                          setFormRtc({
                            ...formRtc,
                            pdlMinRor: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        PDL Max Sentence
                      </label>
                      <input
                        type="number"
                        className="w-full border rounded px-3 py-2"
                        value={(formRtc.pdlMaxSentence as any) || 0}
                        onChange={(e) =>
                          setFormRtc({
                            ...formRtc,
                            pdlMaxSentence: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        PDL Dismissal
                      </label>
                      <input
                        type="number"
                        className="w-full border rounded px-3 py-2"
                        value={(formRtc.pdlDismissal as any) || 0}
                        onChange={(e) =>
                          setFormRtc({
                            ...formRtc,
                            pdlDismissal: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        PDL Acquittal
                      </label>
                      <input
                        type="number"
                        className="w-full border rounded px-3 py-2"
                        value={(formRtc.pdlAcquittal as any) || 0}
                        onChange={(e) =>
                          setFormRtc({
                            ...formRtc,
                            pdlAcquittal: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        PDL Min Sentence
                      </label>
                      <input
                        type="number"
                        className="w-full border rounded px-3 py-2"
                        value={(formRtc.pdlMinSentence as any) || 0}
                        onChange={(e) =>
                          setFormRtc({
                            ...formRtc,
                            pdlMinSentence: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        PDL Probation
                      </label>
                      <input
                        type="number"
                        className="w-full border rounded px-3 py-2"
                        value={(formRtc.pdlProbation as any) || 0}
                        onChange={(e) =>
                          setFormRtc({
                            ...formRtc,
                            pdlProbation: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        CICL M
                      </label>
                      <input
                        type="number"
                        className="w-full border rounded px-3 py-2"
                        value={(formRtc.ciclM as any) || 0}
                        onChange={(e) =>
                          setFormRtc({
                            ...formRtc,
                            ciclM: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        CICL F
                      </label>
                      <input
                        type="number"
                        className="w-full border rounded px-3 py-2"
                        value={(formRtc.ciclF as any) || 0}
                        onChange={(e) =>
                          setFormRtc({
                            ...formRtc,
                            ciclF: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        CICL V
                      </label>
                      <input
                        type="number"
                        className="w-full border rounded px-3 py-2"
                        value={(formRtc.ciclV as any) || 0}
                        onChange={(e) =>
                          setFormRtc({
                            ...formRtc,
                            ciclV: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        CICL In-C
                      </label>
                      <input
                        type="number"
                        className="w-full border rounded px-3 py-2"
                        value={(formRtc.ciclInC as any) || 0}
                        onChange={(e) =>
                          setFormRtc({
                            ...formRtc,
                            ciclInC: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Fine
                    </label>
                    <input
                      type="number"
                      className="w-full border rounded px-3 py-2"
                      value={(formRtc.fine as any) || 0}
                      onChange={(e) =>
                        setFormRtc({ ...formRtc, fine: Number(e.target.value) })
                      }
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Total
                    </label>
                    <input
                      type="number"
                      className="w-full border rounded px-3 py-2"
                      value={(formRtc.total as any) || 0}
                      onChange={(e) =>
                        setFormRtc({
                          ...formRtc,
                          total: Number(e.target.value),
                        })
                      }
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 bg-blue-500 text-white py-2 rounded"
                    >
                      {editingRtcId ? "Update" : "Add"}
                    </button>
                    {editingRtcId && (
                      <button
                        type="button"
                        onClick={() => {
                          setFormRtc(emptyRtc);
                          setEditingRtcId(null);
                        }}
                        className="flex-1 bg-gray-500 text-white py-2 rounded"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              </div>
            </div>

            <div className="lg:col-span-2">
              <div className="bg-white rounded-lg shadow p-6 mb-6">
                <div className="flex gap-2">
                  <button
                    onClick={loadAll}
                    disabled={loading}
                    className="bg-green-500 text-white px-4 py-2 rounded"
                  >
                    Refresh
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-200">
                    <tr>
                      <th className="px-4 py-2 text-left">ID</th>
                      {rtcLeafColumns.map((c) => (
                        <th key={c.key} className="px-4 py-2 text-left">
                          {c.key}
                        </th>
                      ))}
                      <th className="px-4 py-2 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rtc.length === 0 ? (
                      <tr>
                        <td
                          colSpan={rtcLeafColumns.length + 2}
                          className="px-4 py-4 text-center text-gray-500"
                        >
                          No regional records
                        </td>
                      </tr>
                    ) : (
                      rtc.map((r) => (
                        <tr key={r.id} className="border-t hover:bg-gray-50">
                          <td className="px-4 py-2">{r.id}</td>
                          {rtcLeafColumns.map((c) => (
                            <td key={c.key} className="px-4 py-2">
                              {c.render(r as Record<string, unknown>)}
                            </td>
                          ))}
                          <td className="px-4 py-2">
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  setFormRtc(r);
                                  setEditingRtcId(r.id || null);
                                }}
                                className="bg-yellow-400 px-3 py-1 rounded text-xs"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => r.id && handleDeleteRtc(r.id)}
                                className="bg-red-500 text-white px-3 py-1 rounded text-xs"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
