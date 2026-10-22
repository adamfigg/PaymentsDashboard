import { Button, Result } from "antd"
import { Link, Route, Routes, useNavigate } from "react-router-dom"

import { NewTransactionPage } from "./pages/NewTransactionPage"
import { TransactionDetailPage } from "./pages/TransactionDetailPage"
import { TransactionsPage } from "./pages/TransactionsPage"

const App = () => {
  const navigate = useNavigate()

  return (
    <div className="app">
      <nav className="app-nav">
        <Link to="/" className="brand">
          Payment Portal
        </Link>
        <Button type="primary" onClick={() => navigate("/transactions/new")}>
          New transaction
        </Button>
      </nav>

      <Routes>
        <Route path="/" element={<TransactionsPage />} />
        {/* react-router ranks the static "new" segment above ":id", so order doesn't matter. */}
        <Route path="/transactions/new" element={<NewTransactionPage />} />
        <Route path="/transactions/:id" element={<TransactionDetailPage />} />
        <Route
          path="*"
          element={
            <Result
              status="404"
              title="Page not found"
              subTitle="There's nothing at this address."
              extra={
                <Button type="primary" onClick={() => navigate("/")}>
                  Go to transactions
                </Button>
              }
            />
          }
        />
      </Routes>
    </div>
  )
}

export default App
