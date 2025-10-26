import { useContext } from 'react';
import { ReplContext } from '../../contexts/repl-context';

export default function OutputArea() {
  const replContext = useContext(ReplContext);
  if (replContext === undefined) {
    throw new Error('ReplContext can only be used in ReplProvider.');
  }

  return (
    <div style={{height: '100%', width: '100%', overflow: 'scroll', scrollbarWidth: 'thin', padding: 10, paddingRight: 20}}>
      { replContext.logs.map((log, id) => 
        <div key={id} style={{color: log.type === 'error' ? '#ff4d4f' : 'black'}}>
          {log.message}
        </div>
      )}
    </div>
  )
}
