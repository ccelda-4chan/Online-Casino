import BlackjackGame from "@/components/games/blackjack-game";
import MainLayout from "@/components/layouts/main-layout";
import TransactionHistory from "@/components/transaction-history";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function BlackjackPage() {
  return (
    <MainLayout>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="game" className="w-full">
          <TabsList className="grid w-full grid-cols-1 md:grid-cols-2 mb-8 gap-3">
            <TabsTrigger value="game">Play Blackjack</TabsTrigger>
            <TabsTrigger value="history">Your History</TabsTrigger>
          </TabsList>
          
          <TabsContent value="game" className="mt-0">
            <BlackjackGame />
          </TabsContent>
          
          <TabsContent value="history">
            <TransactionHistory gameType="blackjack" />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}